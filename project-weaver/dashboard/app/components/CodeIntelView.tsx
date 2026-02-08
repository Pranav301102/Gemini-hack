'use client'

import React, { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  HiCube,
  HiCollection,
  HiLink,
  HiGlobe,
  HiChevronRight,
  HiChevronDown,
  HiArrowRight,
  HiSearch,
} from 'react-icons/hi'

const MermaidDiagram = dynamic(() => import('./MermaidDiagram'), { ssr: false })

// ─── Types (mirrors src/types.ts CodeMaps) ───

interface ClassNode {
  id: string
  name: string
  file: string
  line: number
  extends: string | null
  implements: string[]
  exported: boolean
  methods: { name: string; visibility: string; params: string; returnType?: string }[]
  properties: { name: string; type?: string; visibility: string }[]
  description?: string
}

interface InterfaceNode {
  id: string
  name: string
  file: string
  line: number
  exported: boolean
  fields: { name: string; type: string; optional?: boolean }[]
  description?: string
}

interface ClassRelationship {
  from: string
  to: string
  type: 'extends' | 'implements' | 'uses' | 'creates'
}

interface ModuleNode {
  id: string
  path: string
  fileCount: number
  exports: string[]
  publicAPI: string[]
  responsibility?: string
}

interface ModuleConnection {
  from: string
  to: string
  imports: number
  exportsUsed: string[]
}

interface CallNode {
  id: string
  name: string
  file: string
  line: number
  exported: boolean
  calls: string[]
  calledBy: string[]
  description?: string
}

interface APIEndpoint {
  method: string
  path: string
  file: string
  handler: string
  params?: string[]
  bodyShape?: string
  responseShape?: string
  description?: string
}

export interface CodeMaps {
  version: string
  generatedAt: string
  classMap: {
    classes: ClassNode[]
    interfaces: InterfaceNode[]
    relationships: ClassRelationship[]
  }
  moduleMap: {
    modules: ModuleNode[]
    connections: ModuleConnection[]
    layers: { name: string; modules: string[] }[]
  }
  callGraph: {
    functions: CallNode[]
  }
  apiMap: {
    endpoints: APIEndpoint[]
  }
}

type SubTab = 'classes' | 'modules' | 'dependencies' | 'api'

interface CodeIntelViewProps {
  codeMaps: CodeMaps | null
}

// ─── Mermaid Generators ───

function generateClassDiagram(codeMaps: CodeMaps, filter: string): string {
  const { classes, interfaces, relationships } = codeMaps.classMap
  const q = filter.toLowerCase()

  const filteredClasses = filter
    ? classes.filter(c => c.name.toLowerCase().includes(q))
    : classes.slice(0, 20)
  const filteredInterfaces = filter
    ? interfaces.filter(i => i.name.toLowerCase().includes(q))
    : interfaces.slice(0, 15)

  const ids = new Set([...filteredClasses.map(c => c.id), ...filteredInterfaces.map(i => i.id)])
  const filteredRels = relationships.filter(r => ids.has(r.from) || ids.has(r.to))

  // Also pull in connected nodes that are referenced
  for (const r of filteredRels) {
    if (!ids.has(r.to)) {
      const cls = classes.find(c => c.id === r.to)
      if (cls) { filteredClasses.push(cls); ids.add(cls.id) }
      const iface = interfaces.find(i => i.id === r.to)
      if (iface) { filteredInterfaces.push(iface); ids.add(iface.id) }
    }
  }

  if (filteredClasses.length === 0 && filteredInterfaces.length === 0) {
    return 'flowchart TD\n  A["No classes or interfaces found"]'
  }

  const lines: string[] = ['classDiagram']

  for (const cls of filteredClasses) {
    lines.push(`  class ${sanitizeId(cls.name)} {`)
    for (const p of cls.properties.slice(0, 5)) {
      const vis = p.visibility === 'private' ? '-' : '+'
      lines.push(`    ${vis}${p.name}${p.type ? ' : ' + sanitizeLabel(p.type) : ''}`)
    }
    for (const m of cls.methods.slice(0, 8)) {
      const vis = m.visibility === 'private' ? '-' : '+'
      lines.push(`    ${vis}${m.name}(${sanitizeLabel(m.params)})${m.returnType ? ' : ' + sanitizeLabel(m.returnType) : ''}`)
    }
    lines.push('  }')
  }

  for (const iface of filteredInterfaces) {
    lines.push(`  class ${sanitizeId(iface.name)} {`)
    lines.push(`    <<interface>>`)
    for (const f of iface.fields.slice(0, 8)) {
      lines.push(`    +${f.name} : ${sanitizeLabel(f.type)}`)
    }
    lines.push('  }')
  }

  for (const r of filteredRels) {
    const fromName = sanitizeId(r.from.replace(/^[ci]:/, ''))
    const toName = sanitizeId(r.to.replace(/^[ci]:/, ''))
    if (r.type === 'extends') {
      lines.push(`  ${toName} <|-- ${fromName}`)
    } else if (r.type === 'implements') {
      lines.push(`  ${toName} <|.. ${fromName}`)
    } else if (r.type === 'uses') {
      lines.push(`  ${fromName} --> ${toName} : uses`)
    }
  }

  return lines.join('\n')
}

function generateModuleDiagram(codeMaps: CodeMaps): string {
  const { modules, connections } = codeMaps.moduleMap
  if (modules.length === 0) return 'flowchart TD\n  A["No modules found"]'

  const lines: string[] = ['flowchart TD']

  // Use short IDs and clean labels
  const idMap = new Map<string, string>()
  modules.forEach((mod, i) => {
    const shortId = `M${i}`
    idMap.set(mod.id, shortId)
    const label = mod.path.split('/').slice(-2).join('/')
    const fileCount = mod.fileCount
    lines.push(`  ${shortId}["${label}<br/>${fileCount} files"]`)
  })

  for (const conn of connections.slice(0, 40)) {
    const from = idMap.get(conn.from)
    const to = idMap.get(conn.to)
    if (from && to) {
      lines.push(`  ${from} -->|"${conn.imports}"| ${to}`)
    }
  }

  return lines.join('\n')
}

function generateCallGraphDiagram(codeMaps: CodeMaps, filter: string): string {
  const { functions } = codeMaps.callGraph
  if (functions.length === 0) return 'flowchart TD\n  A["No call graph data"]'

  const q = filter.toLowerCase()

  // Filter to most connected functions or by search
  let filtered = filter
    ? functions.filter(f => f.name.toLowerCase().includes(q))
    : functions
        .sort((a, b) => (b.calls.length + b.calledBy.length) - (a.calls.length + a.calledBy.length))
        .slice(0, 20)

  if (filtered.length === 0) return 'flowchart TD\n  A["No matching functions"]'

  const ids = new Set(filtered.map(f => f.id))

  // Include connected functions that are in the full list
  const allIds = new Set(functions.map(f => f.id))
  for (const fn of filtered) {
    for (const callId of fn.calls) {
      if (allIds.has(callId) && !ids.has(callId)) {
        const target = functions.find(f => f.id === callId)
        if (target) { filtered = [...filtered, target]; ids.add(callId) }
      }
    }
  }

  // Cap at 30 nodes
  filtered = filtered.slice(0, 30)
  const finalIds = new Set(filtered.map(f => f.id))

  const lines: string[] = ['flowchart LR']
  const idMap = new Map<string, string>()

  filtered.forEach((fn, i) => {
    const shortId = `F${i}`
    idMap.set(fn.id, shortId)
    const label = fn.name.length > 25 ? fn.name.slice(0, 22) + '...' : fn.name
    if (fn.exported) {
      lines.push(`  ${shortId}(["${label}"])`)
    } else {
      lines.push(`  ${shortId}["${label}"]`)
    }
  })

  for (const fn of filtered) {
    const fromId = idMap.get(fn.id)
    if (!fromId) continue
    for (const callId of fn.calls) {
      if (finalIds.has(callId)) {
        const toId = idMap.get(callId)
        if (toId) lines.push(`  ${fromId} --> ${toId}`)
      }
    }
  }

  return lines.join('\n')
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

function sanitizeLabel(text: string): string {
  return text.replace(/[<>"{}()]/g, '').slice(0, 40)
}

// ─── Sub-components ───

function ClassesTab({ codeMaps, searchQuery }: { codeMaps: CodeMaps; searchQuery: string }) {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  const [showDiagram, setShowDiagram] = useState(true)

  const toggleClass = (id: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = searchQuery.toLowerCase()
  const classes = searchQuery
    ? codeMaps.classMap.classes.filter(c => c.name.toLowerCase().includes(q) || c.file.toLowerCase().includes(q))
    : codeMaps.classMap.classes
  const interfaces = searchQuery
    ? codeMaps.classMap.interfaces.filter(i => i.name.toLowerCase().includes(q) || i.file.toLowerCase().includes(q))
    : codeMaps.classMap.interfaces
  const { relationships } = codeMaps.classMap

  const classDiagram = useMemo(
    () => generateClassDiagram(codeMaps, searchQuery),
    [codeMaps, searchQuery]
  )

  return (
    <div className="space-y-4">
      {/* Class Hierarchy Diagram */}
      {(classes.length > 0 || interfaces.length > 0) && (
        <div>
          <button
            onClick={() => setShowDiagram(!showDiagram)}
            className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1 hover:text-gray-300"
          >
            {showDiagram ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
            Class Hierarchy Diagram
          </button>
          {showDiagram && (
            <div className="mb-4">
              <MermaidDiagram chart={classDiagram} className="max-h-[400px]" />
            </div>
          )}
        </div>
      )}

      {/* Classes list */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Classes ({classes.length})
        </h3>
        {classes.length === 0 ? (
          <div className="text-xs text-gray-600 italic">
            {searchQuery ? 'No classes matching filter' : 'No classes found'}
          </div>
        ) : (
          <div className="space-y-1">
            {classes.map(cls => {
              const isExpanded = expandedClasses.has(cls.id)
              const rels = relationships.filter(r => r.from === cls.id || r.to === cls.id)

              return (
                <div key={cls.id} className="bg-gray-900/50 rounded border border-gray-800">
                  <button
                    onClick={() => toggleClass(cls.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors"
                  >
                    {isExpanded ? (
                      <HiChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    ) : (
                      <HiChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    )}
                    <HiCube className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-white font-medium">{cls.name}</span>
                    {cls.exported && (
                      <span className="text-[9px] bg-green-900/50 text-green-400 px-1 rounded">export</span>
                    )}
                    {cls.extends && (
                      <span className="text-[9px] bg-purple-900/50 text-purple-400 px-1 rounded">
                        extends {cls.extends.replace('c:', '')}
                      </span>
                    )}
                    {cls.implements.length > 0 && (
                      <span className="text-[9px] bg-cyan-900/50 text-cyan-400 px-1 rounded">
                        impl {cls.implements.map(i => i.replace('i:', '')).join(', ')}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-600">{cls.file}:{cls.line}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-2 space-y-2 border-t border-gray-800/50">
                      {cls.description && (
                        <p className="text-xs text-gray-400 mt-2">{cls.description}</p>
                      )}

                      {cls.methods.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Methods</div>
                          <div className="space-y-0.5">
                            {cls.methods.map((m, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.visibility === 'private' ? 'bg-red-500' : 'bg-green-500'}`} />
                                <code className="text-gray-300">
                                  {m.name}({m.params}){m.returnType ? `: ${m.returnType}` : ''}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {cls.properties.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Properties</div>
                          <div className="space-y-0.5">
                            {cls.properties.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.visibility === 'private' ? 'bg-red-500' : 'bg-green-500'}`} />
                                <code className="text-gray-300">
                                  {p.name}{p.type ? `: ${p.type}` : ''}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rels.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Relationships</div>
                          <div className="flex flex-wrap gap-1">
                            {rels.map((r, i) => {
                              const isSource = r.from === cls.id
                              const other = isSource ? r.to : r.from
                              const colors: Record<string, string> = {
                                extends: 'bg-purple-900/50 text-purple-400',
                                implements: 'bg-cyan-900/50 text-cyan-400',
                                uses: 'bg-yellow-900/50 text-yellow-400',
                                creates: 'bg-green-900/50 text-green-400',
                              }
                              return (
                                <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${colors[r.type] ?? 'bg-gray-800 text-gray-400'}`}>
                                  {isSource ? '' : '← '}{r.type} {other.replace(/^[ci]:/, '')}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Interfaces */}
      {interfaces.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Interfaces ({interfaces.length})
          </h3>
          <div className="space-y-1">
            {interfaces.map((iface, idx) => (
              <div key={`${iface.id}:${iface.file}:${idx}`} className="bg-gray-900/50 rounded border border-gray-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded border border-cyan-500 flex-shrink-0" />
                  <span className="text-sm text-white font-medium">{iface.name}</span>
                  <span className="text-[10px] text-gray-600">{iface.file}</span>
                </div>
                {iface.fields.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {iface.fields.slice(0, 8).map((f, i) => (
                      <code key={i} className="text-[10px] text-gray-500">
                        {f.name}{f.optional ? '?' : ''}: {f.type}
                      </code>
                    ))}
                    {iface.fields.length > 8 && (
                      <span className="text-[10px] text-gray-600">+{iface.fields.length - 8} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModulesTab({ codeMaps, searchQuery }: { codeMaps: CodeMaps; searchQuery: string }) {
  const [showDiagram, setShowDiagram] = useState(true)
  const { modules, connections, layers } = codeMaps.moduleMap

  const q = searchQuery.toLowerCase()
  const filteredModules = searchQuery
    ? modules.filter(m => m.path.toLowerCase().includes(q) || m.publicAPI.some(a => a.toLowerCase().includes(q)))
    : modules

  const moduleDiagram = useMemo(() => generateModuleDiagram(codeMaps), [codeMaps])

  return (
    <div className="space-y-4">
      {/* Module Architecture Diagram */}
      {modules.length > 0 && (
        <div>
          <button
            onClick={() => setShowDiagram(!showDiagram)}
            className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1 hover:text-gray-300"
          >
            {showDiagram ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
            Module Architecture Diagram
          </button>
          {showDiagram && (
            <div className="mb-4">
              <MermaidDiagram chart={moduleDiagram} className="max-h-[400px]" />
            </div>
          )}
        </div>
      )}

      {/* Layers */}
      {layers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Architecture Layers</h3>
          <div className="space-y-1">
            {layers.map((layer, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-gray-500 w-28 flex-shrink-0 text-right">{layer.name}</span>
                <HiArrowRight className="w-3 h-3 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {layer.modules.map(modId => {
                    const mod = modules.find(m => m.id === modId)
                    return (
                      <span key={modId} className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                        {mod?.path ?? modId.replace('mod:', '')}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module Cards */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Modules ({filteredModules.length})</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filteredModules.map(mod => {
            const outgoing = connections.filter(c => c.from === mod.id)
            const incoming = connections.filter(c => c.to === mod.id)

            return (
              <div key={mod.id} className="bg-gray-900/50 rounded border border-gray-800 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <HiCollection className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-sm text-white font-medium truncate">{mod.path}</span>
                  <span className="ml-auto text-[10px] text-gray-600">{mod.fileCount} files</span>
                </div>

                {mod.responsibility && (
                  <p className="text-xs text-gray-400 mb-1">{mod.responsibility}</p>
                )}

                {mod.publicAPI.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {mod.publicAPI.slice(0, 6).map(api => (
                      <code key={api} className="text-[10px] bg-blue-900/30 text-blue-400 px-1 rounded">{api}</code>
                    ))}
                    {mod.publicAPI.length > 6 && (
                      <span className="text-[10px] text-gray-600">+{mod.publicAPI.length - 6}</span>
                    )}
                  </div>
                )}

                {(outgoing.length > 0 || incoming.length > 0) && (
                  <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                    {outgoing.length > 0 && <span>→ {outgoing.length} deps</span>}
                    {incoming.length > 0 && <span>← {incoming.length} importers</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DependenciesTab({ codeMaps, searchQuery }: { codeMaps: CodeMaps; searchQuery: string }) {
  const [showCallDiagram, setShowCallDiagram] = useState(true)
  const { connections } = codeMaps.moduleMap

  const q = searchQuery.toLowerCase()
  const filteredConns = searchQuery
    ? connections.filter(c =>
        c.from.toLowerCase().includes(q) || c.to.toLowerCase().includes(q) ||
        c.exportsUsed.some(e => e.toLowerCase().includes(q))
      )
    : connections
  const sortedConns = [...filteredConns].sort((a, b) => b.imports - a.imports)

  const callDiagram = useMemo(
    () => generateCallGraphDiagram(codeMaps, searchQuery),
    [codeMaps, searchQuery]
  )

  return (
    <div className="space-y-4">
      {/* Call Graph Diagram */}
      <div>
        <button
          onClick={() => setShowCallDiagram(!showCallDiagram)}
          className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1 hover:text-gray-300"
        >
          {showCallDiagram ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
          Call Graph {searchQuery ? `(filtered: "${searchQuery}")` : '(top connected)'}
        </button>
        {showCallDiagram && codeMaps.callGraph.functions.length > 0 && (
          <div className="mb-4">
            <MermaidDiagram chart={callDiagram} className="max-h-[400px]" />
          </div>
        )}
      </div>

      {/* Module Dependencies Table */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Module Dependencies ({sortedConns.length})
        </h3>
        {sortedConns.length === 0 ? (
          <div className="text-xs text-gray-600 italic">
            {searchQuery ? 'No dependencies matching filter' : 'No inter-module dependencies found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1.5 px-2 font-medium">From</th>
                  <th className="text-left py-1.5 px-2 font-medium">To</th>
                  <th className="text-center py-1.5 px-2 font-medium">Imports</th>
                  <th className="text-left py-1.5 px-2 font-medium">Symbols Used</th>
                </tr>
              </thead>
              <tbody>
                {sortedConns.map((conn, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-1.5 px-2 text-gray-300">{conn.from.replace('mod:', '')}</td>
                    <td className="py-1.5 px-2 text-gray-300">
                      <div className="flex items-center gap-1">
                        <HiArrowRight className="w-3 h-3 text-gray-600" />
                        {conn.to.replace('mod:', '')}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        conn.imports > 5 ? 'bg-orange-900/50 text-orange-400' :
                        conn.imports > 2 ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {conn.imports}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {conn.exportsUsed.slice(0, 4).map(sym => (
                          <code key={sym} className="text-[10px] text-gray-500">{sym}</code>
                        ))}
                        {conn.exportsUsed.length > 4 && (
                          <span className="text-[10px] text-gray-600">+{conn.exportsUsed.length - 4}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Call Graph List */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Call Graph ({codeMaps.callGraph.functions.length} functions)
        </h3>
        {codeMaps.callGraph.functions.length === 0 ? (
          <div className="text-xs text-gray-600 italic">No function call data available</div>
        ) : (
          <div className="space-y-1">
            {codeMaps.callGraph.functions
              .filter(fn => !searchQuery || fn.name.toLowerCase().includes(q) || fn.file.toLowerCase().includes(q))
              .sort((a, b) => (b.calls.length + b.calledBy.length) - (a.calls.length + a.calledBy.length))
              .slice(0, 20)
              .map(fn => (
                <div key={fn.id} className="flex items-center gap-2 text-xs bg-gray-900/50 rounded px-2 py-1.5 border border-gray-800/50">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fn.exported ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <code className="text-gray-300 flex-1 truncate">{fn.name}</code>
                  <span className="text-[10px] text-gray-600 truncate max-w-[120px]">{fn.file}</span>
                  {fn.calls.length > 0 && (
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1 rounded">→{fn.calls.length}</span>
                  )}
                  {fn.calledBy.length > 0 && (
                    <span className="text-[10px] bg-purple-900/30 text-purple-400 px-1 rounded">←{fn.calledBy.length}</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

function APITab({ codeMaps, searchQuery }: { codeMaps: CodeMaps; searchQuery: string }) {
  const { endpoints } = codeMaps.apiMap
  const q = searchQuery.toLowerCase()
  const filtered = searchQuery
    ? endpoints.filter(ep => ep.path.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q) || ep.handler.toLowerCase().includes(q))
    : endpoints

  const methodColors: Record<string, string> = {
    GET: 'bg-green-900/50 text-green-400 border-green-800',
    POST: 'bg-blue-900/50 text-blue-400 border-blue-800',
    PUT: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    PATCH: 'bg-orange-900/50 text-orange-400 border-orange-800',
    DELETE: 'bg-red-900/50 text-red-400 border-red-800',
    ALL: 'bg-gray-800 text-gray-400 border-gray-700',
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
        API Endpoints ({filtered.length})
      </h3>
      {filtered.length === 0 ? (
        <div className="text-xs text-gray-600 italic">
          {searchQuery ? 'No endpoints matching filter' : 'No API endpoints detected'}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((ep, i) => (
            <div key={i} className="bg-gray-900/50 rounded border border-gray-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${methodColors[ep.method] ?? methodColors.ALL}`}>
                  {ep.method}
                </span>
                <code className="text-sm text-white font-medium">{ep.path}</code>
                <span className="ml-auto text-[10px] text-gray-600">{ep.file}</span>
                <code className="text-[10px] text-gray-500">{ep.handler}</code>
              </div>
              {(ep.params || ep.description) && (
                <div className="mt-1 text-xs text-gray-500">
                  {ep.description && <span>{ep.description}</span>}
                  {ep.params && <span className="ml-2">params: {ep.params.join(', ')}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───

export default function CodeIntelView({ codeMaps }: CodeIntelViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('classes')
  const [searchQuery, setSearchQuery] = useState('')

  if (!codeMaps) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <HiCube className="w-8 h-8 mx-auto mb-2 text-gray-700" />
          <p className="text-sm">No code maps available</p>
          <p className="text-xs text-gray-600 mt-1">Run /read to generate code intelligence data</p>
        </div>
      </div>
    )
  }

  const tabs: { id: SubTab; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: 'classes',
      label: 'Classes',
      icon: <HiCube className="w-3.5 h-3.5" />,
      count: codeMaps.classMap.classes.length + codeMaps.classMap.interfaces.length,
    },
    {
      id: 'modules',
      label: 'Modules',
      icon: <HiCollection className="w-3.5 h-3.5" />,
      count: codeMaps.moduleMap.modules.length,
    },
    {
      id: 'dependencies',
      label: 'Dependencies',
      icon: <HiLink className="w-3.5 h-3.5" />,
      count: codeMaps.moduleMap.connections.length + codeMaps.callGraph.functions.length,
    },
    {
      id: 'api',
      label: 'API',
      icon: <HiGlobe className="w-3.5 h-3.5" />,
      count: codeMaps.apiMap.endpoints.length,
    },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar + Search */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4 flex items-center gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-[10px] px-1 rounded ${
              activeTab === tab.id ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <HiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="bg-gray-900 border border-gray-800 rounded pl-7 pr-2 py-1 text-xs text-gray-300 w-40 focus:outline-none focus:border-gray-600"
            />
          </div>
          <span className="text-[10px] text-gray-600">
            {new Date(codeMaps.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-800/50 flex gap-4 text-[10px] text-gray-500">
        <span>{codeMaps.classMap.classes.length} classes</span>
        <span>{codeMaps.classMap.interfaces.length} interfaces</span>
        <span>{codeMaps.classMap.relationships.length} relationships</span>
        <span className="text-gray-700">|</span>
        <span>{codeMaps.moduleMap.modules.length} modules</span>
        <span>{codeMaps.moduleMap.connections.length} connections</span>
        <span className="text-gray-700">|</span>
        <span>{codeMaps.callGraph.functions.length} functions</span>
        <span>{codeMaps.apiMap.endpoints.length} endpoints</span>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'classes' && <ClassesTab codeMaps={codeMaps} searchQuery={searchQuery} />}
        {activeTab === 'modules' && <ModulesTab codeMaps={codeMaps} searchQuery={searchQuery} />}
        {activeTab === 'dependencies' && <DependenciesTab codeMaps={codeMaps} searchQuery={searchQuery} />}
        {activeTab === 'api' && <APITab codeMaps={codeMaps} searchQuery={searchQuery} />}
      </div>
    </div>
  )
}
