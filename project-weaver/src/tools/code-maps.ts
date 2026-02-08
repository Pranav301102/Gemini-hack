import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';
import type {
  ProjectIndex,
  FileIndex,
  CodeMaps,
  ClassMap,
  ClassNode,
  InterfaceNode,
  ClassRelationship,
  ModuleMap,
  ModuleNode,
  ModuleConnection,
  CallGraph,
  CallNode,
  APIMap,
  APIEndpoint,
} from '../types.js';

const CODE_MAPS_FILE = 'code-maps.json';

// ─── Class Map Builder ───

function buildClassMap(index: ProjectIndex): ClassMap {
  const classes: ClassNode[] = [];
  const interfaces: InterfaceNode[] = [];
  const relationships: ClassRelationship[] = [];

  // Known class/interface names for relationship detection
  const knownClasses = new Set<string>();
  const knownInterfaces = new Set<string>();

  // First pass: collect all class and interface names
  for (const file of index.files) {
    for (const cls of file.classes) {
      knownClasses.add(cls.name);
    }
    for (const td of file.types) {
      if (td.kind === 'interface') {
        knownInterfaces.add(td.name);
      }
    }
  }

  // Second pass: build nodes and relationships
  for (const file of index.files) {
    for (const cls of file.classes) {
      const id = `c:${cls.name}`;

      classes.push({
        id,
        name: cls.name,
        file: file.path,
        line: cls.line,
        extends: cls.extends ? `c:${cls.extends}` : null,
        implements: (cls.implements ?? []).map(i => `i:${i}`),
        exported: cls.exported,
        methods: cls.methods.map(m => ({
          name: m.name,
          visibility: m.name.startsWith('_') ? 'private' : 'public',
          params: m.params.join(', '),
          returnType: m.returnType,
        })),
        properties: cls.properties.map(p => ({
          name: p.name,
          type: p.type,
          visibility: p.name.startsWith('_') ? 'private' : 'public',
        })),
        description: cls.enrichedDescription ?? cls.description,
      });

      // extends relationship
      if (cls.extends && knownClasses.has(cls.extends)) {
        relationships.push({ from: id, to: `c:${cls.extends}`, type: 'extends' });
      }

      // implements relationships
      for (const impl of cls.implements ?? []) {
        if (knownInterfaces.has(impl)) {
          relationships.push({ from: id, to: `i:${impl}`, type: 'implements' });
        }
      }

      // "uses" relationships: scan method return types and property types
      const typeRefs = new Set<string>();
      for (const m of cls.methods) {
        if (m.returnType) extractTypeRefs(m.returnType, typeRefs);
      }
      for (const p of cls.properties) {
        if (p.type) extractTypeRefs(p.type, typeRefs);
      }

      for (const ref of typeRefs) {
        if (ref !== cls.name) {
          if (knownClasses.has(ref)) {
            relationships.push({ from: id, to: `c:${ref}`, type: 'uses' });
          } else if (knownInterfaces.has(ref)) {
            relationships.push({ from: id, to: `i:${ref}`, type: 'uses' });
          }
        }
      }
    }

    // Interfaces from type definitions
    for (const td of file.types) {
      if (td.kind === 'interface') {
        interfaces.push({
          id: `i:${td.name}`,
          name: td.name,
          file: file.path,
          line: 0, // types don't store line numbers in the current index
          exported: true, // types are generally exported
          fields: (td.fields ?? []).map(f => ({
            name: f.name,
            type: f.type,
            optional: f.optional,
          })),
          description: td.enrichedDescription ?? td.description,
        });
      }
    }
  }

  // Deduplicate classes and interfaces by ID (same name in multiple files)
  const seenClassIds = new Set<string>();
  const uniqueClasses = classes.filter(c => {
    if (seenClassIds.has(c.id)) return false;
    seenClassIds.add(c.id);
    return true;
  });

  const seenIfaceIds = new Set<string>();
  const uniqueInterfaces = interfaces.filter(i => {
    if (seenIfaceIds.has(i.id)) return false;
    seenIfaceIds.add(i.id);
    return true;
  });

  // Deduplicate relationships
  const relSet = new Set<string>();
  const uniqueRels = relationships.filter(r => {
    const key = `${r.from}|${r.to}|${r.type}`;
    if (relSet.has(key)) return false;
    relSet.add(key);
    return true;
  });

  return { classes: uniqueClasses, interfaces: uniqueInterfaces, relationships: uniqueRels };
}

/** Extract type name references from a type string */
function extractTypeRefs(typeStr: string, refs: Set<string>): void {
  // Match PascalCase identifiers (likely class/interface names)
  const matches = typeStr.match(/\b[A-Z][a-zA-Z0-9]+\b/g);
  if (matches) {
    for (const m of matches) {
      // Skip common built-in types
      if (!['String', 'Number', 'Boolean', 'Object', 'Array', 'Promise',
            'Map', 'Set', 'Record', 'Partial', 'Required', 'Omit', 'Pick',
            'Readonly', 'ReadonlyArray', 'Exclude', 'Extract', 'ReturnType',
            'InstanceType', 'Parameters', 'Error', 'Date', 'RegExp',
            'Function', 'Symbol', 'BigInt', 'Buffer', 'Uint8Array',
            'HTMLElement', 'HTMLDivElement', 'HTMLInputElement',
            'React', 'JSX', 'FC', 'ReactNode', 'ReactElement'].includes(m)) {
        refs.add(m);
      }
    }
  }
}

// ─── Module Map Builder ───

function buildModuleMap(index: ProjectIndex): ModuleMap {
  const dirMap = new Map<string, FileIndex[]>();

  // Group files by directory
  for (const file of index.files) {
    const dir = path.dirname(file.path) || '.';
    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push(file);
  }

  const modules: ModuleNode[] = [];
  const connections: ModuleConnection[] = [];
  const connectionMap = new Map<string, { imports: number; exportsUsed: Set<string> }>();

  for (const [dir, files] of dirMap) {
    const moduleId = `mod:${dir}`;
    const allExports: string[] = [];
    const publicAPI: string[] = [];

    for (const file of files) {
      allExports.push(...file.exports);

      // Public API = exported functions and classes
      for (const fn of file.functions) {
        if (fn.exported) publicAPI.push(fn.name);
      }
      for (const cls of file.classes) {
        if (cls.exported) publicAPI.push(cls.name);
      }
    }

    modules.push({
      id: moduleId,
      path: dir,
      fileCount: files.length,
      exports: [...new Set(allExports)],
      publicAPI: [...new Set(publicAPI)].slice(0, 20), // Cap at 20 for readability
    });

    // Build connections from import data
    for (const file of files) {
      for (const imp of file.imports) {
        // Resolve relative imports to find target directory
        if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) continue;

        const importerDir = path.dirname(file.path);
        const targetPath = path.normalize(path.join(importerDir, imp.source));
        let targetDir = path.dirname(targetPath);

        // Check if target is actually in our index (could be a directory import)
        const targetFile = index.files.find(f =>
          f.path === targetPath ||
          f.path === targetPath + '.ts' ||
          f.path === targetPath + '.tsx' ||
          f.path === targetPath + '.js' ||
          f.path === targetPath + '/index.ts' ||
          f.path === targetPath + '/index.tsx' ||
          f.path === targetPath + '/index.js'
        );

        if (targetFile) {
          targetDir = path.dirname(targetFile.path);
        }

        if (targetDir === dir) continue; // Skip intra-module imports

        const targetModuleId = `mod:${targetDir}`;
        const connKey = `${moduleId}→${targetModuleId}`;

        if (!connectionMap.has(connKey)) {
          connectionMap.set(connKey, { imports: 0, exportsUsed: new Set() });
        }
        const conn = connectionMap.get(connKey)!;
        conn.imports++;
        for (const name of imp.names) {
          conn.exportsUsed.add(name);
        }
      }
    }
  }

  // Convert connection map to array
  for (const [key, data] of connectionMap) {
    const [from, to] = key.split('→');
    connections.push({
      from,
      to,
      imports: data.imports,
      exportsUsed: [...data.exportsUsed],
    });
  }

  // Auto-detect layers by topological analysis
  const layers = detectLayers(modules, connections);

  return { modules, connections, layers };
}

/** Auto-detect architectural layers from module dependencies */
function detectLayers(
  modules: ModuleNode[],
  connections: ModuleConnection[],
): { name: string; modules: string[] }[] {
  // Build in-degree and out-degree
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const mod of modules) {
    inDegree.set(mod.id, 0);
    outDegree.set(mod.id, 0);
  }

  for (const conn of connections) {
    inDegree.set(conn.to, (inDegree.get(conn.to) ?? 0) + 1);
    outDegree.set(conn.from, (outDegree.get(conn.from) ?? 0) + 1);
  }

  // Classify modules into layers
  const entryModules: string[] = [];     // High out-degree, low in-degree
  const coreModules: string[] = [];      // Mix of both
  const utilModules: string[] = [];      // High in-degree, low out-degree (shared/utility)
  const leafModules: string[] = [];      // Low everything

  for (const mod of modules) {
    const inD = inDegree.get(mod.id) ?? 0;
    const outD = outDegree.get(mod.id) ?? 0;

    if (inD === 0 && outD > 0) {
      entryModules.push(mod.id);
    } else if (inD > 2 && outD <= 1) {
      utilModules.push(mod.id);
    } else if (outD > 0 || inD > 0) {
      coreModules.push(mod.id);
    } else {
      leafModules.push(mod.id);
    }
  }

  const layers: { name: string; modules: string[] }[] = [];
  if (entryModules.length > 0) layers.push({ name: 'Entry Points', modules: entryModules });
  if (coreModules.length > 0) layers.push({ name: 'Core', modules: coreModules });
  if (utilModules.length > 0) layers.push({ name: 'Shared / Utilities', modules: utilModules });
  if (leafModules.length > 0) layers.push({ name: 'Standalone', modules: leafModules });

  return layers;
}

// ─── Call Graph Builder ───

function buildCallGraph(index: ProjectIndex): CallGraph {
  const functions: CallNode[] = [];
  const nameToId = new Map<string, string>();

  // First pass: build all function nodes with IDs
  for (const file of index.files) {
    for (const fn of file.functions) {
      const id = `f:${file.path}:${fn.name}`;
      nameToId.set(fn.name, id);

      functions.push({
        id,
        name: fn.name,
        file: file.path,
        line: fn.line,
        exported: fn.exported,
        calls: [],
        calledBy: [],
        description: fn.enrichedDescription ?? fn.description,
      });
    }
  }

  // Second pass: resolve callsites to function IDs
  for (const file of index.files) {
    for (const fn of file.functions) {
      if (!fn.callsites) continue;
      const callerId = `f:${file.path}:${fn.name}`;
      const callerNode = functions.find(f => f.id === callerId);
      if (!callerNode) continue;

      for (const callsite of fn.callsites) {
        // Try to find the callee in our function list
        // First check if it's a local function in the same file
        const localId = `f:${file.path}:${callsite.name}`;
        let targetId = functions.find(f => f.id === localId)?.id;

        // Then check cross-file by name (using imports to narrow down)
        if (!targetId) {
          // Check if the function name matches an imported name
          for (const imp of file.imports) {
            if (imp.names.includes(callsite.name)) {
              // Find the function in the target file
              const matchingFn = functions.find(f =>
                f.name === callsite.name && f.exported
              );
              if (matchingFn) {
                targetId = matchingFn.id;
                break;
              }
            }
          }
        }

        // Fallback: match by simple name (may have duplicates, pick first exported)
        if (!targetId) {
          const simpleName = callsite.name.includes('.')
            ? callsite.name.split('.').pop()!
            : callsite.name;
          const match = functions.find(f =>
            f.name === simpleName && f.id !== callerId
          );
          if (match) targetId = match.id;
        }

        if (targetId && !callerNode.calls.includes(targetId)) {
          callerNode.calls.push(targetId);

          // Update calledBy on the target
          const targetNode = functions.find(f => f.id === targetId);
          if (targetNode && !targetNode.calledBy.includes(callerId)) {
            targetNode.calledBy.push(callerId);
          }
        }
      }
    }
  }

  // Filter out functions with no connections to keep the graph manageable
  // Keep exported functions and any function with calls/calledBy
  const connectedFunctions = functions.filter(f =>
    f.exported || f.calls.length > 0 || f.calledBy.length > 0
  );

  return { functions: connectedFunctions };
}

// ─── API Map Builder ───

function buildAPIMap(index: ProjectIndex): APIMap {
  const endpoints: APIEndpoint[] = [];

  for (const file of index.files) {
    // Next.js App Router: app/**/route.ts files
    if (file.path.match(/app\/.*\/route\.(ts|js|tsx|jsx)$/)) {
      const routePath = extractNextJSRoutePath(file.path);
      for (const fn of file.functions) {
        const method = fn.name.toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method)) {
          endpoints.push({
            method,
            path: routePath,
            file: file.path,
            handler: fn.name,
            params: extractRouteParams(routePath),
            description: fn.enrichedDescription ?? fn.description,
          });
        }
      }
    }

    // Next.js Pages Router: pages/api/**/*.ts files
    if (file.path.match(/pages\/api\/.*\.(ts|js|tsx|jsx)$/)) {
      const routePath = extractPagesAPIRoutePath(file.path);
      const defaultExport = file.functions.find(f => f.name === 'default' || f.name === 'handler');
      if (defaultExport) {
        endpoints.push({
          method: 'ALL',
          path: routePath,
          file: file.path,
          handler: defaultExport.name,
          params: extractRouteParams(routePath),
          description: defaultExport.enrichedDescription ?? defaultExport.description,
        });
      }
    }

    // Express-style routes: look for router.get/post/etc or app.get/post/etc
    for (const fn of file.functions) {
      if (!fn.callsites) continue;
      for (const callsite of fn.callsites) {
        const match = callsite.name.match(/^(router|app)\.(get|post|put|delete|patch)$/i);
        if (match) {
          endpoints.push({
            method: match[2].toUpperCase(),
            path: '(dynamic)', // Can't easily extract path string from AST callsite
            file: file.path,
            handler: fn.name,
            description: fn.enrichedDescription ?? fn.description,
          });
        }
      }
    }
  }

  return { endpoints };
}

/** Extract Next.js App Router path from file path */
function extractNextJSRoutePath(filePath: string): string {
  // app/api/users/[id]/route.ts → /api/users/[id]
  const match = filePath.match(/app\/(.*?)\/route\.(ts|js|tsx|jsx)$/);
  if (!match) return filePath;
  return '/' + match[1];
}

/** Extract Next.js Pages API path from file path */
function extractPagesAPIRoutePath(filePath: string): string {
  // pages/api/users/[id].ts → /api/users/[id]
  const match = filePath.match(/pages\/(api\/.*?)\.(ts|js|tsx|jsx)$/);
  if (!match) return filePath;
  return '/' + match[1];
}

/** Extract route parameters from a path like /api/users/[id] */
function extractRouteParams(routePath: string): string[] {
  const params: string[] = [];
  const matches = routePath.matchAll(/\[([^\]]+)\]/g);
  for (const m of matches) {
    params.push(m[1]);
  }
  return params.length > 0 ? params : undefined as unknown as string[];
}

// ─── Main Builder ───

function buildCodeMaps(index: ProjectIndex): CodeMaps {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    classMap: buildClassMap(index),
    moduleMap: buildModuleMap(index),
    callGraph: buildCallGraph(index),
    apiMap: buildAPIMap(index),
  };
}

// ─── MCP Tool Registration ───

export function registerCodeMaps(server: McpServer): void {

  server.tool(
    'build_code_maps',
    'Build traversable code maps from the project index: class hierarchy, module architecture, call graph, and API endpoints. Run after index_project and build_dependency_graph.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
    },
    async ({ workspacePath }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized. Run read_project first.' }) }],
        };
      }

      const index = manager.readIndex();
      if (!index) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No index found. Run index_project first.' }) }],
        };
      }

      const codeMaps = buildCodeMaps(index);

      // Save to standalone file
      const codeMapsPath = path.join(workspacePath, '.weaver', CODE_MAPS_FILE);
      fs.writeFileSync(codeMapsPath, JSON.stringify(codeMaps, null, 2), 'utf-8');

      // Also store reference in the index
      index.codeMaps = codeMaps;
      manager.writeIndex(index);

      manager.logEvent({
        level: 'info',
        agent: 'architect',
        phase: 'read',
        action: 'code_maps_built',
        message: `Built code maps: ${codeMaps.classMap.classes.length} classes, ${codeMaps.moduleMap.modules.length} modules, ${codeMaps.callGraph.functions.length} functions, ${codeMaps.apiMap.endpoints.length} endpoints`,
        data: {
          classes: codeMaps.classMap.classes.length,
          interfaces: codeMaps.classMap.interfaces.length,
          relationships: codeMaps.classMap.relationships.length,
          modules: codeMaps.moduleMap.modules.length,
          connections: codeMaps.moduleMap.connections.length,
          functions: codeMaps.callGraph.functions.length,
          endpoints: codeMaps.apiMap.endpoints.length,
        },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Code maps built successfully`,
            summary: {
              classMap: {
                classes: codeMaps.classMap.classes.length,
                interfaces: codeMaps.classMap.interfaces.length,
                relationships: codeMaps.classMap.relationships.length,
                topClasses: codeMaps.classMap.classes.slice(0, 10).map(c => ({
                  name: c.name,
                  file: c.file,
                  methods: c.methods.length,
                  extends: c.extends,
                })),
              },
              moduleMap: {
                modules: codeMaps.moduleMap.modules.length,
                connections: codeMaps.moduleMap.connections.length,
                layers: codeMaps.moduleMap.layers,
              },
              callGraph: {
                functions: codeMaps.callGraph.functions.length,
                withCalls: codeMaps.callGraph.functions.filter(f => f.calls.length > 0).length,
                withCalledBy: codeMaps.callGraph.functions.filter(f => f.calledBy.length > 0).length,
              },
              apiMap: {
                endpoints: codeMaps.apiMap.endpoints.length,
                byMethod: codeMaps.apiMap.endpoints.reduce((acc, e) => {
                  acc[e.method] = (acc[e.method] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
                routes: codeMaps.apiMap.endpoints.map(e => `${e.method} ${e.path}`),
              },
            },
          }),
        }],
      };
    },
  );

  server.tool(
    'get_code_maps',
    'Query code maps for specific views. Use during plan phase to understand codebase structure without reading every file. Views: summary (overview), classes (class hierarchy), modules (architecture), calls (function relationships), api (endpoints), file (single file context).',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      view: z.enum(['summary', 'classes', 'modules', 'calls', 'api', 'file']).describe('Which view to return'),
      query: z.string().optional().describe('Filter by name pattern (for classes/modules/calls views)'),
      file: z.string().optional().describe('Filter by file path (required for "file" view)'),
    },
    async ({ workspacePath, view, query, file }) => {
      const codeMapsPath = path.join(workspacePath, '.weaver', CODE_MAPS_FILE);
      if (!fs.existsSync(codeMapsPath)) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No code maps found. Run build_code_maps first.' }) }],
        };
      }

      const codeMaps: CodeMaps = JSON.parse(fs.readFileSync(codeMapsPath, 'utf-8'));
      let result: unknown;

      switch (view) {
        case 'summary':
          result = {
            generatedAt: codeMaps.generatedAt,
            classes: codeMaps.classMap.classes.length,
            interfaces: codeMaps.classMap.interfaces.length,
            relationships: codeMaps.classMap.relationships.length,
            modules: codeMaps.moduleMap.modules.length,
            layers: codeMaps.moduleMap.layers,
            functions: codeMaps.callGraph.functions.length,
            endpoints: codeMaps.apiMap.endpoints.length,
            topClasses: codeMaps.classMap.classes.slice(0, 5).map(c => c.name),
            topModules: codeMaps.moduleMap.modules.slice(0, 5).map(m => m.path),
            apiRoutes: codeMaps.apiMap.endpoints.map(e => `${e.method} ${e.path}`),
          };
          break;

        case 'classes': {
          let classes = codeMaps.classMap.classes;
          let ifaces = codeMaps.classMap.interfaces;
          let rels = codeMaps.classMap.relationships;

          if (query) {
            const q = query.toLowerCase();
            classes = classes.filter(c => c.name.toLowerCase().includes(q));
            ifaces = ifaces.filter(i => i.name.toLowerCase().includes(q));
            const ids = new Set([...classes.map(c => c.id), ...ifaces.map(i => i.id)]);
            rels = rels.filter(r => ids.has(r.from) || ids.has(r.to));
          }

          result = { classes, interfaces: ifaces, relationships: rels };
          break;
        }

        case 'modules': {
          let modules = codeMaps.moduleMap.modules;
          let connections = codeMaps.moduleMap.connections;

          if (query) {
            const q = query.toLowerCase();
            modules = modules.filter(m => m.path.toLowerCase().includes(q));
            const ids = new Set(modules.map(m => m.id));
            connections = connections.filter(c => ids.has(c.from) || ids.has(c.to));
          }

          result = { modules, connections, layers: codeMaps.moduleMap.layers };
          break;
        }

        case 'calls': {
          let functions = codeMaps.callGraph.functions;

          if (query) {
            const q = query.toLowerCase();
            functions = functions.filter(f => f.name.toLowerCase().includes(q));
          }

          result = { functions };
          break;
        }

        case 'api':
          result = { endpoints: codeMaps.apiMap.endpoints };
          break;

        case 'file': {
          if (!file) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'The "file" parameter is required for file view.' }) }],
            };
          }

          // Get all code map data related to this file
          const fileClasses = codeMaps.classMap.classes.filter(c => c.file === file);
          const fileInterfaces = codeMaps.classMap.interfaces.filter(i => i.file === file);
          const fileClassIds = new Set([...fileClasses.map(c => c.id), ...fileInterfaces.map(i => i.id)]);
          const fileRelationships = codeMaps.classMap.relationships.filter(r =>
            fileClassIds.has(r.from) || fileClassIds.has(r.to)
          );

          const fileFunctions = codeMaps.callGraph.functions.filter(f => f.file === file);
          const fileEndpoints = codeMaps.apiMap.endpoints.filter(e => e.file === file);

          // Find which module this file belongs to
          const fileDir = path.dirname(file);
          const fileModule = codeMaps.moduleMap.modules.find(m => m.path === fileDir);

          result = {
            file,
            module: fileModule ?? null,
            classes: fileClasses,
            interfaces: fileInterfaces,
            relationships: fileRelationships,
            functions: fileFunctions,
            endpoints: fileEndpoints,
          };
          break;
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, view, result }),
        }],
      };
    },
  );
}
