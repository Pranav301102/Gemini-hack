import { z } from 'zod';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';
/**
 * Format a function into a compact readable signature.
 */
function formatFunction(fn) {
    const async = fn.isAsync ? 'async ' : '';
    const params = fn.params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
    const ret = fn.returnType ? `: ${fn.returnType}` : '';
    return {
        name: fn.name,
        signature: `${async}${fn.name}(${params})${ret}`,
        description: fn.enrichedDescription ?? fn.description ?? '(not described)',
        exported: fn.exported,
        isComponent: fn.isComponent,
        isAsync: fn.isAsync,
        line: fn.line,
    };
}
/**
 * Format a class into a compact readable summary.
 */
function formatClass(cls) {
    return {
        name: cls.name,
        description: cls.enrichedDescription ?? cls.description ?? '(not described)',
        methods: cls.methods.map(m => m.name),
        properties: cls.properties.map(p => `${p.name}${p.type ? ': ' + p.type : ''}`),
        extends: cls.extends,
        implements: cls.implements,
        line: cls.line,
    };
}
/**
 * Format a type into a compact readable summary.
 */
function formatType(t) {
    return {
        name: t.name,
        kind: t.kind,
        description: t.enrichedDescription ?? t.description ?? '(not described)',
        fields: t.fields?.map(f => `${f.name}${f.optional ? '?' : ''}: ${f.type}`),
        values: t.values,
    };
}
/**
 * Get import/export relationships for a file from the dependency graph.
 */
function getFileRelationships(filePath, graph, index) {
    const importsFrom = [];
    const importedBy = [];
    if (!graph)
        return { importsFrom, importedBy };
    for (const edge of graph.edges) {
        if (edge.from === filePath) {
            const targetFile = index.files.find(f => f.path === edge.to);
            importsFrom.push({
                file: edge.to,
                names: edge.imports,
                description: targetFile?.enrichedDescription ?? targetFile?.description,
            });
        }
        if (edge.to === filePath) {
            const sourceFile = index.files.find(f => f.path === edge.from);
            importedBy.push({
                file: edge.from,
                names: edge.imports,
                description: sourceFile?.enrichedDescription ?? sourceFile?.description,
            });
        }
    }
    return { importsFrom, importedBy };
}
/**
 * Get files in the same directory cluster.
 */
function getRelatedFiles(filePath, graph) {
    if (!graph)
        return [];
    const dir = path.dirname(filePath);
    const cluster = graph.clusters.find(c => c.directory === dir);
    return cluster?.files.filter(f => f !== filePath) ?? [];
}
export function registerCodeIntel(server) {
    // ─── understand_file ───
    server.tool('understand_file', 'Get complete understanding of a file without reading source: enriched descriptions, all functions/classes/types, dependencies, dependents, and related files. This is agent memory — use it before reading any source file.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        filePath: z.string().describe('Relative file path to understand (e.g., "src/controllers/todoController.ts")'),
    }, async ({ workspacePath, filePath }) => {
        const manager = new BoardManager(workspacePath);
        const index = manager.readIndex();
        if (!index) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No index found. Run index_project first.' }) }],
            };
        }
        // Find the file — try exact match first, then substring
        let file = index.files.find(f => f.path === filePath);
        if (!file) {
            file = index.files.find(f => f.path.endsWith(filePath) || f.path.includes(filePath));
        }
        if (!file) {
            // Suggest similar files
            const suggestions = index.files
                .filter(f => f.path.toLowerCase().includes(path.basename(filePath).toLowerCase().split('.')[0]))
                .map(f => f.path)
                .slice(0, 5);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `File not found in index: ${filePath}`,
                            suggestions: suggestions.length > 0 ? suggestions : undefined,
                            hint: 'Use the relative path from the workspace root.',
                        }),
                    }],
            };
        }
        const { importsFrom, importedBy } = getFileRelationships(file.path, index.dependencyGraph, index);
        const relatedFiles = getRelatedFiles(file.path, index.dependencyGraph);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        file: {
                            path: file.path,
                            language: file.language,
                            size: file.size,
                            description: file.enrichedDescription ?? file.description ?? '(not described)',
                            exports: file.exports,
                        },
                        functions: file.functions.map(formatFunction),
                        classes: file.classes.map(formatClass),
                        types: file.types.map(formatType),
                        variables: file.variables.map(v => ({
                            name: v.name,
                            type: v.type,
                            description: v.enrichedDescription ?? v.description,
                            exported: v.exported,
                        })),
                        dependencies: {
                            importsFrom,
                            importedBy,
                        },
                        relatedFiles,
                    }),
                }],
        };
    });
    // ─── search_codebase ───
    server.tool('search_codebase', 'Search across the enriched code index by name or description. Find functions, classes, types, and variables without reading source files. Use this to discover existing code before writing new code.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        query: z.string().describe('Search term — matches names and enriched descriptions'),
        kind: z.enum(['function', 'class', 'type', 'variable', 'file', 'all']).optional().describe('Filter by kind (default: all)'),
        exported: z.boolean().optional().describe('Only show exported items'),
        limit: z.number().optional().describe('Max results (default: 20, max: 50)'),
    }, async ({ workspacePath, query, kind, exported, limit }) => {
        const manager = new BoardManager(workspacePath);
        const index = manager.readIndex();
        if (!index) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No index found. Run index_project first.' }) }],
            };
        }
        const maxResults = Math.min(limit ?? 20, 50);
        const q = query.toLowerCase();
        const kindFilter = kind ?? 'all';
        const results = [];
        for (const file of index.files) {
            // Search file-level
            if (kindFilter === 'file' || kindFilter === 'all') {
                const desc = file.enrichedDescription ?? file.description ?? '';
                const nameMatch = file.path.toLowerCase().includes(q);
                const descMatch = desc.toLowerCase().includes(q);
                if (nameMatch || descMatch) {
                    results.push({
                        file: file.path,
                        name: path.basename(file.path),
                        kind: 'file',
                        description: desc || '(not described)',
                        line: 0,
                        exported: true,
                        score: nameMatch ? (path.basename(file.path).toLowerCase() === q ? 100 : 60) : 30,
                    });
                }
            }
            // Search functions
            if (kindFilter === 'function' || kindFilter === 'all') {
                for (const fn of file.functions) {
                    if (exported && !fn.exported)
                        continue;
                    const nameL = fn.name.toLowerCase();
                    const descL = (fn.enrichedDescription ?? fn.description ?? '').toLowerCase();
                    const nameExact = nameL === q;
                    const nameContains = nameL.includes(q);
                    const descContains = descL.includes(q);
                    if (nameExact || nameContains || descContains) {
                        const async = fn.isAsync ? 'async ' : '';
                        const params = fn.params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
                        const ret = fn.returnType ? `: ${fn.returnType}` : '';
                        results.push({
                            file: file.path,
                            name: fn.name,
                            kind: 'function',
                            description: fn.enrichedDescription ?? fn.description ?? '(not described)',
                            signature: `${async}${fn.name}(${params})${ret}`,
                            line: fn.line,
                            exported: fn.exported,
                            score: nameExact ? 100 : nameContains ? 70 : 30,
                        });
                    }
                }
            }
            // Search classes
            if (kindFilter === 'class' || kindFilter === 'all') {
                for (const cls of file.classes) {
                    if (exported && !cls.exported)
                        continue;
                    const nameL = cls.name.toLowerCase();
                    const descL = (cls.enrichedDescription ?? cls.description ?? '').toLowerCase();
                    const nameExact = nameL === q;
                    const nameContains = nameL.includes(q);
                    const descContains = descL.includes(q);
                    if (nameExact || nameContains || descContains) {
                        results.push({
                            file: file.path,
                            name: cls.name,
                            kind: 'class',
                            description: cls.enrichedDescription ?? cls.description ?? '(not described)',
                            signature: `class ${cls.name}${cls.extends ? ' extends ' + cls.extends : ''} { ${cls.methods.map(m => m.name).join(', ')} }`,
                            line: cls.line,
                            exported: cls.exported,
                            score: nameExact ? 100 : nameContains ? 70 : 30,
                        });
                    }
                }
            }
            // Search types
            if (kindFilter === 'type' || kindFilter === 'all') {
                for (const t of file.types) {
                    const nameL = t.name.toLowerCase();
                    const descL = (t.enrichedDescription ?? t.description ?? '').toLowerCase();
                    const nameExact = nameL === q;
                    const nameContains = nameL.includes(q);
                    const descContains = descL.includes(q);
                    if (nameExact || nameContains || descContains) {
                        results.push({
                            file: file.path,
                            name: t.name,
                            kind: t.kind,
                            description: t.enrichedDescription ?? t.description ?? '(not described)',
                            line: 0,
                            exported: true,
                            score: nameExact ? 100 : nameContains ? 70 : 30,
                        });
                    }
                }
            }
            // Search variables
            if (kindFilter === 'variable' || kindFilter === 'all') {
                for (const v of file.variables) {
                    if (exported && !v.exported)
                        continue;
                    const nameL = v.name.toLowerCase();
                    const descL = (v.enrichedDescription ?? v.description ?? '').toLowerCase();
                    const nameExact = nameL === q;
                    const nameContains = nameL.includes(q);
                    const descContains = descL.includes(q);
                    if (nameExact || nameContains || descContains) {
                        results.push({
                            file: file.path,
                            name: v.name,
                            kind: 'variable',
                            description: v.enrichedDescription ?? v.description ?? '(not described)',
                            signature: `${v.kind} ${v.name}${v.type ? ': ' + v.type : ''}`,
                            line: v.line,
                            exported: v.exported,
                            score: nameExact ? 100 : nameContains ? 70 : 30,
                        });
                    }
                }
            }
        }
        // Sort by score descending, then by name
        results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        const limited = results.slice(0, maxResults);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        query,
                        totalResults: results.length,
                        showing: limited.length,
                        results: limited.map(({ score, ...r }) => r), // Strip internal score
                    }),
                }],
        };
    });
    // ─── get_dependency_graph ───
    server.tool('get_dependency_graph', 'Query the file dependency graph. Shows entry points, shared modules, directory clusters, circular dependencies. Use focus to zoom into a specific file\'s neighborhood.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        focus: z.string().optional().describe('Focus on a specific file or directory — show only its neighborhood'),
        depth: z.number().optional().describe('How many hops from the focus file (default: 2)'),
        view: z.enum(['full', 'entrypoints', 'shared', 'clusters', 'circular']).optional().describe('What to show (default: full)'),
    }, async ({ workspacePath, focus, depth, view }) => {
        const manager = new BoardManager(workspacePath);
        const index = manager.readIndex();
        if (!index) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No index found.' }) }],
            };
        }
        const graph = index.dependencyGraph;
        if (!graph) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No dependency graph found. Run build_dependency_graph first.' }) }],
            };
        }
        const viewType = view ?? 'full';
        // If focus is specified, filter to neighborhood
        if (focus) {
            const maxDepth = depth ?? 2;
            const neighborhood = getNeighborhood(focus, graph, index, maxDepth);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            focus,
                            depth: maxDepth,
                            ...neighborhood,
                        }),
                    }],
            };
        }
        // Views
        switch (viewType) {
            case 'entrypoints':
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                view: 'entrypoints',
                                entryPoints: graph.entryPoints.map(ep => {
                                    const file = index.files.find(f => f.path === ep);
                                    return {
                                        file: ep,
                                        description: file?.enrichedDescription ?? file?.description ?? '(not described)',
                                        exports: file?.exports ?? [],
                                    };
                                }),
                            }),
                        }],
                };
            case 'shared':
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                view: 'shared',
                                sharedModules: graph.sharedModules.map(sm => {
                                    const file = index.files.find(f => f.path === sm.file);
                                    return {
                                        file: sm.file,
                                        importedBy: sm.importedBy,
                                        description: file?.enrichedDescription ?? file?.description ?? '(not described)',
                                        exports: file?.exports ?? [],
                                    };
                                }),
                            }),
                        }],
                };
            case 'clusters':
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                view: 'clusters',
                                clusters: graph.clusters.map(c => ({
                                    directory: c.directory,
                                    fileCount: c.files.length,
                                    files: c.files,
                                    internalEdges: c.internalEdges,
                                    externalEdges: c.externalEdges,
                                    cohesion: c.internalEdges > 0 ? Math.round((c.internalEdges / (c.internalEdges + c.externalEdges)) * 100) : 0,
                                })),
                            }),
                        }],
                };
            case 'circular':
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                view: 'circular',
                                hasCircularDeps: graph.circularDeps.length > 0,
                                circularDeps: graph.circularDeps.map(cycle => ({
                                    files: cycle,
                                    chain: cycle.join(' → ') + ' → ' + cycle[0],
                                })),
                            }),
                        }],
                };
            default: // full
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                view: 'full',
                                summary: {
                                    totalEdges: graph.edges.length,
                                    totalFiles: index.totalFiles,
                                    entryPointCount: graph.entryPoints.length,
                                    entryPoints: graph.entryPoints.slice(0, 5),
                                    sharedModules: graph.sharedModules.slice(0, 5),
                                    clusterCount: graph.clusters.length,
                                    topClusters: graph.clusters.slice(0, 5).map(c => ({
                                        directory: c.directory,
                                        files: c.files.length,
                                        cohesion: c.internalEdges > 0 ? Math.round((c.internalEdges / (c.internalEdges + c.externalEdges)) * 100) + '%' : '0%',
                                    })),
                                    circularDeps: graph.circularDeps.length,
                                    circularDetails: graph.circularDeps.slice(0, 3).map(c => c.join(' → ')),
                                },
                            }),
                        }],
                };
        }
    });
}
/**
 * Get the neighborhood of a file in the dependency graph (BFS).
 */
function getNeighborhood(focus, graph, index, maxDepth) {
    // Find the focus file (support partial path match)
    const focusFile = index.files.find(f => f.path === focus)
        ?? index.files.find(f => f.path.endsWith(focus) || f.path.includes(focus));
    if (!focusFile) {
        return { error: `File not found: ${focus}` };
    }
    const focusPath = focusFile.path;
    const visited = new Set([focusPath]);
    const queue = [];
    // Seed with direct imports and importers
    for (const edge of graph.edges) {
        if (edge.from === focusPath) {
            queue.push({ file: edge.to, depth: 1, direction: 'imports' });
        }
        if (edge.to === focusPath) {
            queue.push({ file: edge.from, depth: 1, direction: 'importedBy' });
        }
    }
    const neighbors = [];
    while (queue.length > 0) {
        const { file, depth, direction } = queue.shift();
        if (visited.has(file))
            continue;
        visited.add(file);
        const fileData = index.files.find(f => f.path === file);
        neighbors.push({
            file,
            depth,
            direction,
            description: fileData?.enrichedDescription ?? fileData?.description,
        });
        if (depth < maxDepth) {
            for (const edge of graph.edges) {
                if (edge.from === file && !visited.has(edge.to)) {
                    queue.push({ file: edge.to, depth: depth + 1, direction: 'imports' });
                }
                if (edge.to === file && !visited.has(edge.from)) {
                    queue.push({ file: edge.from, depth: depth + 1, direction: 'importedBy' });
                }
            }
        }
    }
    // Direct edges involving the focus file
    const directImports = graph.edges
        .filter(e => e.from === focusPath)
        .map(e => ({ file: e.to, imports: e.imports }));
    const directImporters = graph.edges
        .filter(e => e.to === focusPath)
        .map(e => ({ file: e.from, imports: e.imports }));
    return {
        focusFile: {
            path: focusPath,
            description: focusFile.enrichedDescription ?? focusFile.description ?? '(not described)',
            exports: focusFile.exports,
        },
        directImports,
        directImporters,
        neighborhood: neighbors,
        totalNeighbors: neighbors.length,
    };
}
//# sourceMappingURL=code-intel.js.map