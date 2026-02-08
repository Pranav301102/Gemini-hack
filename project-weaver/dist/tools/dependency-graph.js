import { z } from 'zod';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';
/**
 * Resolve a relative import path to an actual file in the index.
 * Returns null for external packages.
 */
function resolveImportPath(importSource, importerFile, allFiles) {
    // Skip external packages (no . prefix)
    if (!importSource.startsWith('.') && !importSource.startsWith('/'))
        return null;
    const importerDir = path.dirname(importerFile);
    const basePath = path.normalize(path.join(importerDir, importSource));
    // Try exact match, then with extensions, then as directory with index
    const candidates = [
        basePath,
        basePath + '.ts', basePath + '.tsx',
        basePath + '.js', basePath + '.jsx',
        basePath + '/index.ts', basePath + '/index.tsx',
        basePath + '/index.js', basePath + '/index.jsx',
    ];
    // Handle .js extension in TS imports (common in ESM projects)
    if (importSource.endsWith('.js')) {
        const withoutJs = basePath.slice(0, -3);
        candidates.push(withoutJs + '.ts', withoutJs + '.tsx');
    }
    for (const candidate of candidates) {
        if (allFiles.has(candidate))
            return candidate;
    }
    return null;
}
/**
 * Build the dependency graph from the project index.
 * Pure computation — no LLM needed.
 */
function computeDependencyGraph(index) {
    const allFiles = new Set(index.files.map(f => f.path));
    const edges = [];
    const inDegree = new Map();
    const outDegree = new Map();
    // Initialize degree maps
    for (const file of allFiles) {
        inDegree.set(file, 0);
        outDegree.set(file, 0);
    }
    // Build edges from imports
    for (const file of index.files) {
        for (const imp of file.imports) {
            const resolved = resolveImportPath(imp.source, file.path, allFiles);
            if (resolved) {
                edges.push({
                    from: file.path,
                    to: resolved,
                    imports: imp.names,
                });
                inDegree.set(resolved, (inDegree.get(resolved) ?? 0) + 1);
                outDegree.set(file.path, (outDegree.get(file.path) ?? 0) + 1);
            }
        }
    }
    // Entry points: files with in-degree 0 (nothing imports them)
    const entryPoints = [...allFiles]
        .filter(f => (inDegree.get(f) ?? 0) === 0)
        .sort();
    // Shared modules: files sorted by in-degree descending
    const sharedModules = [...inDegree.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([file, importedBy]) => ({ file, importedBy }));
    // Directory clusters
    const dirMap = new Map();
    for (const file of allFiles) {
        const dir = path.dirname(file) || '.';
        if (!dirMap.has(dir))
            dirMap.set(dir, []);
        dirMap.get(dir).push(file);
    }
    const clusters = [...dirMap.entries()]
        .filter(([, files]) => files.length > 0)
        .map(([directory, files]) => {
        const fileSet = new Set(files);
        let internalEdges = 0;
        let externalEdges = 0;
        for (const edge of edges) {
            const fromIn = fileSet.has(edge.from);
            const toIn = fileSet.has(edge.to);
            if (fromIn && toIn)
                internalEdges++;
            else if (fromIn || toIn)
                externalEdges++;
        }
        return { directory, files, internalEdges, externalEdges };
    })
        .sort((a, b) => b.files.length - a.files.length);
    // Circular dependency detection (Tarjan's SCC)
    const circularDeps = detectCycles(edges, allFiles);
    return { edges, entryPoints, sharedModules, clusters, circularDeps };
}
/**
 * Detect circular dependencies using DFS-based cycle detection.
 */
function detectCycles(edges, allFiles) {
    const adjacency = new Map();
    for (const file of allFiles) {
        adjacency.set(file, []);
    }
    for (const edge of edges) {
        adjacency.get(edge.from)?.push(edge.to);
    }
    const visited = new Set();
    const inStack = new Set();
    const cycles = [];
    function dfs(node, path) {
        if (inStack.has(node)) {
            // Found a cycle — extract the cycle from the path
            const cycleStart = path.indexOf(node);
            if (cycleStart !== -1) {
                const cycle = path.slice(cycleStart);
                // Normalize: start from the lexicographically smallest node
                const minIdx = cycle.indexOf(cycle.reduce((min, n) => n < min ? n : min));
                const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
                // Deduplicate cycles
                const key = normalized.join(' → ');
                if (!cycles.some(c => {
                    const cMin = c.indexOf(c.reduce((min, n) => n < min ? n : min));
                    const cNorm = [...c.slice(cMin), ...c.slice(0, cMin)];
                    return cNorm.join(' → ') === key;
                })) {
                    cycles.push(normalized);
                }
            }
            return;
        }
        if (visited.has(node))
            return;
        visited.add(node);
        inStack.add(node);
        path.push(node);
        for (const neighbor of adjacency.get(node) ?? []) {
            dfs(neighbor, path);
        }
        path.pop();
        inStack.delete(node);
    }
    for (const file of allFiles) {
        if (!visited.has(file)) {
            dfs(file, []);
        }
    }
    return cycles;
}
export function registerDependencyGraph(server) {
    server.tool('build_dependency_graph', 'Compute a file dependency graph from import/export data in the code index. Detects entry points, shared modules, directory clusters, and circular dependencies. Run after index_project.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized. Run read_project first.' }) }],
            };
        }
        const index = manager.readIndex();
        if (!index) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No index found. Run index_project first.' }) }],
            };
        }
        const graph = computeDependencyGraph(index);
        // Store in the index
        index.dependencyGraph = graph;
        manager.writeIndex(index);
        manager.logEvent({
            level: 'info',
            agent: 'architect',
            phase: 'read',
            action: 'dependency_graph_built',
            message: `Built dependency graph: ${graph.edges.length} edges, ${graph.entryPoints.length} entry points, ${graph.circularDeps.length} circular deps`,
            data: {
                edges: graph.edges.length,
                entryPoints: graph.entryPoints.length,
                sharedModules: graph.sharedModules.length,
                clusters: graph.clusters.length,
                circularDeps: graph.circularDeps.length,
            },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Dependency graph computed: ${graph.edges.length} edges across ${index.totalFiles} files`,
                        summary: {
                            totalEdges: graph.edges.length,
                            entryPoints: graph.entryPoints.slice(0, 10),
                            entryPointCount: graph.entryPoints.length,
                            sharedModules: graph.sharedModules.slice(0, 10),
                            clusters: graph.clusters.map(c => ({
                                directory: c.directory,
                                fileCount: c.files.length,
                                internalEdges: c.internalEdges,
                                externalEdges: c.externalEdges,
                            })),
                            circularDeps: graph.circularDeps,
                            hasCircularDeps: graph.circularDeps.length > 0,
                        },
                    }),
                }],
        };
    });
}
//# sourceMappingURL=dependency-graph.js.map