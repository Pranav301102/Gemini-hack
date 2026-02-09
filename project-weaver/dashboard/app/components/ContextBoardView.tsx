'use client'

import React, { useState, useMemo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import MermaidDiagram from './MermaidDiagram'
import { WidgetGrid } from './WidgetRenderer'
import type { DashboardWidget } from './WidgetRenderer'
import {
  HiLightBulb,
  HiDocumentText,
  HiQuestionMarkCircle,
  HiChat,
  HiMap,
  HiPencil,
  HiX,
  HiReply,
  HiCode,
  HiCollection,
  HiCheckCircle,
  HiClipboardCheck,
  HiChevronDown,
  HiChevronRight,
} from 'react-icons/hi'

interface ContextEntry {
  id: string
  timestamp: string
  agent: string
  phase?: string
  stage?: string // legacy support
  type: string
  title: string
  content: string
  parentId?: string
  metadata?: { type?: string; [key: string]: unknown }
}

interface ProjectData {
  name: string
  description: string
  requirements: string[]
  techStack?: string[]
  constraints?: string[]
  targetUsers?: string
  deploymentTarget?: string
}

interface TrackedFile {
  path: string
  agent: string
  phase?: string
  timestamp: string
  size: number
}

interface ContextBoardViewProps {
  entries: ContextEntry[]
  widgets: DashboardWidget[]
  selectedPhase: string | null
  onPhaseFilter: (phase: string | null) => void
  projectPath?: string
  geminiReady?: boolean
  project?: ProjectData | null
  phase?: string
  files?: TrackedFile[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan?: ContextBoardPlan | any | null
}

interface PlanDiscussion {
  id: string
  timestamp: string
  agent: string
  type: string
  content: string
}

interface ContextBoardPlan {
  summary?: string
  goals?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discussion?: PlanDiscussion[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changeGroups?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagrams?: any[]
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  brainstorm: { icon: HiChat, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Brainstorm' },
  proposal: { icon: HiPencil, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Proposal' },
  decision: { icon: HiLightBulb, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Decision' },
  artifact: { icon: HiDocumentText, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Artifact' },
  question: { icon: HiQuestionMarkCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Question' },
  'memory-map': { icon: HiMap, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Memory Map' },
}

const AGENT_COLORS: Record<string, string> = {
  'product-manager': 'border-purple-500',
  'architect': 'border-blue-500',
  'developer': 'border-green-500',
  'qa': 'border-yellow-500',
  'code-reviewer': 'border-red-500',
}

const AGENT_LABELS: Record<string, string> = {
  'product-manager': 'Product Manager',
  'architect': 'Architect',
  'developer': 'Developer',
  'qa': 'QA Engineer',
  'code-reviewer': 'Code Reviewer',
}

const PHASE_LABELS: Record<string, string> = {
  read: 'Read',
  plan: 'Plan',
  ready: 'Ready',
}

const ContextBoardView: React.FC<ContextBoardViewProps> = ({ entries, widgets, selectedPhase, onPhaseFilter, project, phase, files, plan }) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showWidgets, setShowWidgets] = useState(true)

  // Merge plan discussion entries into the context board so brainstorming is visible
  const allEntries = useMemo(() => {
    const merged = [...entries]
    const existingIds = new Set(entries.map(e => e.id))

    // Surface plan discussion items as brainstorm entries
    if (plan?.discussion) {
      for (const disc of plan.discussion) {
        if (!existingIds.has(disc.id)) {
          merged.push({
            id: disc.id,
            timestamp: disc.timestamp,
            agent: disc.agent,
            phase: 'plan',
            type: 'brainstorm',
            title: `${disc.type.charAt(0).toUpperCase() + disc.type.slice(1)} — ${AGENT_LABELS[disc.agent] ?? disc.agent}`,
            content: disc.content,
          })
        }
      }
    }

    // Surface plan changeGroup changes as proposal entries
    if (plan?.changeGroups) {
      for (const group of plan.changeGroups) {
        for (const change of group.changes ?? []) {
          const syntheticId = `proposal-${change.id}`
          if (!existingIds.has(syntheticId)) {
            merged.push({
              id: syntheticId,
              timestamp: plan.createdAt ?? new Date().toISOString(),
              agent: group.agent ?? 'architect',
              phase: 'plan',
              type: 'proposal',
              title: change.title,
              content: `**${change.changeType.toUpperCase()}** \`${change.file}\`\n\n${change.description}${change.rationale ? `\n\n**Rationale:** ${change.rationale}` : ''}${change.codeSnippet ? `\n\n\`\`\`\n${change.codeSnippet}\n\`\`\`` : ''}`,
              metadata: {
                changeId: change.id,
                groupId: group.id,
                groupName: group.name,
                changeType: change.changeType,
                file: change.file,
                priority: change.priority,
                complexity: change.complexity,
              },
            })
          }
        }
      }
    }

    // Sort by timestamp descending (newest first)
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged
  }, [entries, plan])

  // Build threaded entries
  const { rootEntries, childMap } = useMemo(() => {
    const childMap = new Map<string, ContextEntry[]>()
    const roots: ContextEntry[] = []

    for (const entry of allEntries) {
      if (entry.parentId) {
        const existing = childMap.get(entry.parentId) ?? []
        existing.push(entry)
        childMap.set(entry.parentId, existing)
      } else {
        roots.push(entry)
      }
    }

    return { rootEntries: roots, childMap }
  }, [allEntries])

  const filteredEntries = rootEntries.filter(e => {
    const entryPhase = e.phase ?? e.stage ?? ''
    if (selectedPhase && entryPhase !== selectedPhase) return false
    if (typeFilter && e.type !== typeFilter) return false
    return true
  })

  const filteredWidgets = useMemo(() => {
    if (!widgets || widgets.length === 0) return []
    return [...widgets].sort((a, b) => a.order - b.order)
  }, [widgets])

  const toggleExpanded = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  }

  const renderEntry = (entry: ContextEntry, isChild = false) => {
    const config = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.artifact
    const Icon = config.icon
    const borderColor = AGENT_COLORS[entry.agent] ?? 'border-gray-600'
    const isExpanded = expandedEntries.has(entry.id)
    const isLong = entry.content.length > 200
    const children = childMap.get(entry.id) ?? []
    const entryPhase = entry.phase ?? entry.stage ?? ''

    return (
      <div key={entry.id} className={isChild ? 'ml-6' : ''}>
        <div
          className={`border-l-2 ${borderColor} bg-gray-900/50 rounded-r-lg overflow-hidden ${
            isChild ? 'border-l border-dashed' : ''
          }`}
        >
          {isChild && (
            <div className="px-4 pt-2 flex items-center gap-1 text-[10px] text-gray-600">
              <HiReply className="w-3 h-3" />
              <span>Reply to thread</span>
            </div>
          )}

          <div
            className="px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
            onClick={() => toggleExpanded(entry.id)}
          >
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-200">{entry.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                  {children.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      {children.length} {children.length === 1 ? 'reply' : 'replies'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500">
                    {AGENT_LABELS[entry.agent] ?? entry.agent}
                  </span>
                  <span className="text-[10px] text-gray-700">|</span>
                  <span className="text-[10px] text-gray-600">{PHASE_LABELS[entryPhase] ?? entryPhase}</span>
                  <span className="text-[10px] text-gray-700">|</span>
                  <span className="text-[10px] text-gray-600">{formatTime(entry.timestamp)}</span>
                </div>
              </div>
              {isLong && (
                <span className="text-[10px] text-gray-600 flex-shrink-0">
                  {isExpanded ? 'Collapse' : 'Expand'}
                </span>
              )}
            </div>
          </div>

          {(isExpanded || !isLong) && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-gray-800 pt-3">
                {(entry.metadata as any)?.type === 'diagram' ? (
                  <MermaidDiagram chart={entry.content} />
                ) : (
                  <MarkdownRenderer content={entry.content} />
                )}
              </div>
            </div>
          )}

          {!isExpanded && isLong && (
            <div className="px-4 pb-3">
              <p className="text-[11px] text-gray-500 line-clamp-2">{entry.content.substring(0, 200)}...</p>
            </div>
          )}
        </div>

        {children.length > 0 && isExpanded && (
          <div className="mt-1 space-y-1">
            {children.map(child => renderEntry(child, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Context Board</h2>
            {selectedPhase && (
              <button
                onClick={() => onPhaseFilter(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                {PHASE_LABELS[selectedPhase] ?? selectedPhase}
                <HiX className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filteredWidgets.length > 0 && (
              <button
                onClick={() => setShowWidgets(!showWidgets)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  showWidgets ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-800/50 text-gray-500'
                }`}
              >
                Widgets ({filteredWidgets.length})
              </button>
            )}
            <span className="text-[10px] text-gray-500">{filteredEntries.length} entries</span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter(null)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              typeFilter === null ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
            }`}
          >
            All
          </button>
          {Object.entries(TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                typeFilter === type ? `${config.bg} ${config.color}` : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showWidgets && filteredWidgets.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <WidgetGrid
              widgets={filteredWidgets}
              className="grid-cols-1 lg:grid-cols-2"
            />
          </div>
        )}

        {/* Project overview card (always shown when project exists) */}
        {project && (
          <div className="p-4 border-b border-gray-800">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <HiCollection className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{project.name}</h3>
                  <p className="text-[10px] text-gray-500">{project.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Phase</div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      phase === 'ready' ? 'bg-green-500' : phase === 'plan' ? 'bg-blue-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-xs font-medium text-white">
                      {PHASE_LABELS[phase ?? 'read'] ?? phase}
                    </span>
                  </div>
                </div>
                {project.techStack && project.techStack.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tech Stack</div>
                    <div className="flex items-center gap-1">
                      <HiCode className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-300 truncate">
                        {project.techStack.slice(0, 3).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Files</div>
                  <div className="flex items-center gap-1">
                    <HiCheckCircle className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-300">{files?.length ?? 0} tracked</span>
                  </div>
                </div>
              </div>

              {project.requirements && project.requirements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Requirements</div>
                  <div className="space-y-1">
                    {project.requirements.slice(0, 5).map((req, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-gray-600 mt-0.5 text-[10px]">&#x2022;</span>
                        <span className="text-[11px] text-gray-400">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Implementation Checklist */}
        {plan?.changeGroups && plan.changeGroups.length > 0 && !typeFilter && (
          <ImplementationChecklist plan={plan} files={files} />
        )}

        {filteredEntries.length === 0 && filteredWidgets.length === 0 && !project ? (
          <div className="p-8 text-center text-gray-600 text-xs">
            <p>No project loaded</p>
            <p className="mt-1 text-gray-700">Set a project path and refresh to get started</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredEntries.map((entry) => renderEntry(entry))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Implementation Checklist Component ---

const CHANGE_TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  create: { color: 'text-green-400', bg: 'bg-green-400/10' },
  modify: { color: 'text-blue-400', bg: 'bg-blue-400/10' },
  refactor: { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  delete: { color: 'text-red-400', bg: 'bg-red-400/10' },
  extend: { color: 'text-purple-400', bg: 'bg-purple-400/10' },
}

const PRIORITY_BADGE: Record<string, { color: string; bg: string }> = {
  'must-have': { color: 'text-red-400', bg: 'bg-red-400/10' },
  'should-have': { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  'nice-to-have': { color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

interface ImplementationChecklistProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan: any
  files?: TrackedFile[]
}

const ImplementationChecklist: React.FC<ImplementationChecklistProps> = ({ plan, files }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['__all__']))
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  // Auto-check items whose files have been tracked (written by developer)
  const trackedPaths = useMemo(() => {
    return new Set((files ?? []).map(f => f.path))
  }, [files])

  const isChangeImplemented = (change: any) => {
    const file = (change.file ?? '').replace(/^NEW:\s*/, '')
    return trackedPaths.has(file) || checkedItems.has(change.id)
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalChanges = plan.changeGroups.reduce((sum: number, g: any) => sum + (g.changes?.length ?? 0), 0)
  const completedChanges = plan.changeGroups.reduce((sum: number, g: any) => {
    return sum + (g.changes ?? []).filter((c: any) => isChangeImplemented(c)).length
  }, 0)
  const progressPercent = totalChanges > 0 ? Math.round((completedChanges / totalChanges) * 100) : 0

  return (
    <div className="p-4 border-b border-gray-800">
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiClipboardCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white">Implementation Checklist</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">
                {completedChanges}/{totalChanges} done
              </span>
              <span className={`text-[10px] font-bold ${
                progressPercent === 100 ? 'text-green-400' : progressPercent > 50 ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {progressPercent}%
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Change Groups */}
        <div className="divide-y divide-gray-800/50">
          {plan.changeGroups
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((group: any) => {
              const isExpanded = expandedGroups.has(group.id) || expandedGroups.has('__all__')
              const groupChanges = group.changes ?? []
              const groupDone = groupChanges.filter((c: any) => isChangeImplemented(c)).length
              const allDone = groupDone === groupChanges.length && groupChanges.length > 0
              const agentColor = AGENT_COLORS[group.agent] ?? 'border-gray-600'

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/30 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <HiChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    ) : (
                      <HiChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    )}
                    <div className={`w-1 h-4 rounded-full flex-shrink-0 ${agentColor.replace('border-', 'bg-')}`} />
                    <span className={`text-xs font-medium flex-1 truncate ${
                      allDone ? 'text-green-400 line-through opacity-60' : 'text-gray-200'
                    }`}>
                      {group.name || `Group ${group.order + 1}`}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {groupDone}/{groupChanges.length}
                    </span>
                    {allDone && <HiCheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                  </button>

                  {/* Changes list */}
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {groupChanges.map((change: any) => {
                        const done = isChangeImplemented(change)
                        const changeBadge = CHANGE_TYPE_BADGE[change.changeType] ?? CHANGE_TYPE_BADGE.modify
                        const priorityBadge = PRIORITY_BADGE[change.priority] ?? PRIORITY_BADGE['nice-to-have']

                        return (
                          <div
                            key={change.id}
                            className={`flex items-start gap-2 pl-6 py-1.5 rounded hover:bg-gray-800/20 transition-colors cursor-pointer ${
                              done ? 'opacity-50' : ''
                            }`}
                            onClick={() => toggleCheck(change.id)}
                          >
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded border mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${
                              done
                                ? 'bg-green-500/20 border-green-500 text-green-400'
                                : 'border-gray-600 hover:border-gray-400'
                            }`}>
                              {done && (
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Change info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[11px] ${done ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                  {change.title}
                                </span>
                                <span className={`text-[8px] px-1 py-0.5 rounded ${changeBadge.bg} ${changeBadge.color}`}>
                                  {change.changeType}
                                </span>
                                <span className={`text-[8px] px-1 py-0.5 rounded ${priorityBadge.bg} ${priorityBadge.color}`}>
                                  {change.priority}
                                </span>
                              </div>
                              <span className="text-[9px] text-gray-600 font-mono block mt-0.5 truncate">
                                {change.file}
                              </span>
                            </div>
                          </div>
                        )
                      })}
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

export default ContextBoardView
