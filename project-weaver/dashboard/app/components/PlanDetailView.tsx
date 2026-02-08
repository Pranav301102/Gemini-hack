'use client'

import React, { useState, useMemo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import MermaidDiagram from './MermaidDiagram'
import { WidgetGrid } from './WidgetRenderer'
import type { DashboardWidget } from './WidgetRenderer'
import {
  HiDocumentAdd,
  HiPencilAlt,
  HiCode,
  HiTrash,
  HiPuzzle,
  HiChat,
  HiMap,
  HiLightBulb,
  HiChevronDown,
  HiChevronRight,
} from 'react-icons/hi'

interface ProposedChange {
  id: string
  file: string
  changeType: string
  title: string
  description: string
  rationale: string
  priority: string
  complexity: string
  affectedFunctions?: string[]
  affectedClasses?: string[]
  affectedTypes?: string[]
  dependencies: string[]
  codeSnippet?: string
}

interface ChangeGroup {
  id: string
  name: string
  description: string
  agent: string
  changes: ProposedChange[]
  order: number
}

interface FileChangeMap {
  file: string
  exists: boolean
  language: string
  currentDescription?: string
  changes: { changeId: string; changeType: string; summary: string }[]
  totalChanges: number
  maxPriority: string
}

interface BrainstormEntry {
  id: string
  timestamp: string
  agent: string
  type: string
  content: string
  referencedFiles?: string[]
}

interface PlanDiagram {
  id: string
  title: string
  type: string
  mermaidCode: string
}

interface PlanData {
  id: string
  summary: string
  goals: string[]
  approach: string
  changeGroups: ChangeGroup[]
  architectureNotes: string
  riskAssessment: string
  fileMap: FileChangeMap[]
  discussion: BrainstormEntry[]
  diagrams: PlanDiagram[]
}

interface PlanDetailViewProps {
  plan: PlanData
  selectedGroup: string | null
  selectedFile: string | null
  widgets: DashboardWidget[]
}

const CHANGE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  create: { icon: HiDocumentAdd, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Create' },
  modify: { icon: HiPencilAlt, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Modify' },
  refactor: { icon: HiCode, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Refactor' },
  delete: { icon: HiTrash, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Delete' },
  extend: { icon: HiPuzzle, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Extend' },
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  'must-have': { color: 'text-red-400', bg: 'bg-red-400/10' },
  'should-have': { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  'nice-to-have': { color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const COMPLEXITY_CONFIG: Record<string, string> = {
  trivial: 'bg-gray-700 text-gray-300',
  small: 'bg-green-900/30 text-green-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  large: 'bg-orange-900/30 text-orange-400',
  epic: 'bg-red-900/30 text-red-400',
}

const AGENT_COLORS: Record<string, string> = {
  architect: 'border-blue-500 bg-blue-500/5',
  'product-manager': 'border-purple-500 bg-purple-500/5',
}

const BRAINSTORM_TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  observation: { icon: HiMap, color: 'text-gray-400' },
  proposal: { icon: HiLightBulb, color: 'text-yellow-400' },
  question: { icon: HiChat, color: 'text-purple-400' },
  agreement: { icon: HiLightBulb, color: 'text-green-400' },
  'counter-proposal': { icon: HiPencilAlt, color: 'text-orange-400' },
  decision: { icon: HiLightBulb, color: 'text-blue-400' },
}

const PlanDetailView: React.FC<PlanDetailViewProps> = ({
  plan,
  selectedGroup,
  selectedFile,
  widgets,
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'brainstorm'>('plan')
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set())

  const toggleChange = (id: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sortedWidgets = useMemo(() => {
    if (!widgets || widgets.length === 0) return []
    return [...widgets].sort((a, b) => a.order - b.order)
  }, [widgets])

  const renderChangeCard = (change: ProposedChange, groupName?: string) => {
    const typeConfig = CHANGE_TYPE_CONFIG[change.changeType] ?? CHANGE_TYPE_CONFIG.modify
    const Icon = typeConfig.icon
    const priorityConfig = PRIORITY_CONFIG[change.priority] ?? PRIORITY_CONFIG['nice-to-have']
    const complexityClass = COMPLEXITY_CONFIG[change.complexity] ?? COMPLEXITY_CONFIG.medium
    const isExpanded = expandedChanges.has(change.id)

    return (
      <div key={change.id} className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
        <div
          className="px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
          onClick={() => toggleChange(change.id)}
        >
          <div className="flex items-start gap-2">
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${typeConfig.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-200">{change.title}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${typeConfig.bg} ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${priorityConfig.bg} ${priorityConfig.color}`}>
                  {change.priority}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${complexityClass}`}>
                  {change.complexity}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500 font-mono">{change.file}</span>
                {groupName && (
                  <>
                    <span className="text-[10px] text-gray-700">|</span>
                    <span className="text-[10px] text-gray-600">{groupName}</span>
                  </>
                )}
              </div>
            </div>
            {isExpanded ? <HiChevronDown className="w-3 h-3 text-gray-500" /> : <HiChevronRight className="w-3 h-3 text-gray-500" />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
            <div>
              <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Description</h4>
              <p className="text-xs text-gray-300">{change.description}</p>
            </div>
            <div>
              <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rationale</h4>
              <p className="text-xs text-gray-400">{change.rationale}</p>
            </div>
            {(change.affectedFunctions?.length || change.affectedClasses?.length || change.affectedTypes?.length) && (
              <div>
                <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Affected</h4>
                <div className="flex flex-wrap gap-1">
                  {change.affectedFunctions?.map(f => (
                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 font-mono">{f}()</span>
                  ))}
                  {change.affectedClasses?.map(c => (
                    <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 font-mono">{c}</span>
                  ))}
                  {change.affectedTypes?.map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {change.codeSnippet && (
              <div>
                <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Code Example</h4>
                <pre className="text-[10px] bg-gray-950 rounded p-3 overflow-x-auto text-gray-300 font-mono">{change.codeSnippet}</pre>
              </div>
            )}
            {change.dependencies.length > 0 && (
              <div>
                <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Dependencies</h4>
                <div className="flex flex-wrap gap-1">
                  {change.dependencies.map(d => (
                    <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // File selected view
  if (selectedFile) {
    const fileMap = plan.fileMap.find(f => f.file === selectedFile)
    const fileChanges = plan.changeGroups.flatMap(g =>
      g.changes.filter(c => c.file === selectedFile).map(c => ({ ...c, groupName: g.name }))
    )

    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white font-mono">{selectedFile}</h2>
          {fileMap && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-gray-500">{fileMap.language}</span>
              <span className="text-[10px] text-gray-500">{fileMap.totalChanges} changes</span>
              {fileMap.exists ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400">Exists</span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">New file</span>
              )}
            </div>
          )}
          {fileMap?.currentDescription && (
            <p className="text-[10px] text-gray-500 mt-2">{fileMap.currentDescription}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {fileChanges.map(c => renderChangeCard(c, c.groupName))}
        </div>
      </div>
    )
  }

  // Group selected view
  if (selectedGroup) {
    const group = plan.changeGroups.find(g => g.id === selectedGroup)
    if (!group) return null

    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">{group.name}</h2>
          <p className="text-[10px] text-gray-500 mt-1">{group.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-gray-500">{group.changes.length} changes</span>
            <span className="text-[10px] text-gray-600">
              by {group.agent === 'architect' ? 'Architect' : 'Product Manager'}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {group.changes.map(c => renderChangeCard(c))}
        </div>
      </div>
    )
  }

  // Default plan overview
  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'plan'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Plan Overview
        </button>
        <button
          onClick={() => setActiveTab('brainstorm')}
          className={`px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'brainstorm'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Brainstorm Log
          {plan.discussion.length > 0 && (
            <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded-full">{plan.discussion.length}</span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'plan' ? (
          <div className="p-4 space-y-6">
            {/* Summary */}
            <div>
              <h3 className="text-xs font-semibold text-gray-300 mb-2">Summary</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{plan.summary || 'No summary yet. Run /build to generate a plan.'}</p>
            </div>

            {/* Goals */}
            {plan.goals.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Goals</h3>
                <ul className="space-y-1">
                  {plan.goals.map((goal, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">*</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Approach */}
            {plan.approach && (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Approach</h3>
                <MarkdownRenderer content={plan.approach} />
              </div>
            )}

            {/* Diagrams */}
            {plan.diagrams.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Architecture Diagrams</h3>
                <div className="space-y-4">
                  {plan.diagrams.map(diagram => (
                    <div key={diagram.id} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
                      <h4 className="text-[10px] font-medium text-gray-400 mb-3">{diagram.title}</h4>
                      <MermaidDiagram chart={diagram.mermaidCode} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Widgets */}
            {sortedWidgets.length > 0 && (
              <div>
                <WidgetGrid widgets={sortedWidgets} className="grid-cols-1 lg:grid-cols-2" />
              </div>
            )}

            {/* Architecture Notes */}
            {plan.architectureNotes && (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Architecture Notes</h3>
                <MarkdownRenderer content={plan.architectureNotes} />
              </div>
            )}

            {/* Risk Assessment */}
            {plan.riskAssessment && (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Risk Assessment</h3>
                <MarkdownRenderer content={plan.riskAssessment} />
              </div>
            )}
          </div>
        ) : (
          /* Brainstorm log */
          <div className="p-4 space-y-2">
            {plan.discussion.length === 0 ? (
              <div className="text-center text-gray-600 text-xs py-8">
                <p>No brainstorm entries yet</p>
                <p className="mt-1 text-gray-700">Run /build to start the Architect + PM brainstorm</p>
              </div>
            ) : (
              plan.discussion.map(entry => {
                const typeConfig = BRAINSTORM_TYPE_ICONS[entry.type] ?? BRAINSTORM_TYPE_ICONS.observation
                const Icon = typeConfig.icon
                const agentColor = AGENT_COLORS[entry.agent] ?? 'border-gray-600'
                const agentLabel = entry.agent === 'architect' ? 'Architect' : 'Product Manager'

                return (
                  <div key={entry.id} className={`border-l-2 ${agentColor} rounded-r-lg p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3 h-3 ${typeConfig.color}`} />
                      <span className="text-[10px] font-medium text-gray-300">{agentLabel}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500`}>{entry.type}</span>
                      <span className="text-[9px] text-gray-600 ml-auto">
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{entry.content}</p>
                    {entry.referencedFiles && entry.referencedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.referencedFiles.map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlanDetailView
