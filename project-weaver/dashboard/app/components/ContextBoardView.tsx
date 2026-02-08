'use client'

import React, { useState, useMemo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
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

const ContextBoardView: React.FC<ContextBoardViewProps> = ({ entries, widgets, selectedPhase, onPhaseFilter, project, phase, files }) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showWidgets, setShowWidgets] = useState(true)

  // Build threaded entries
  const { rootEntries, childMap } = useMemo(() => {
    const childMap = new Map<string, ContextEntry[]>()
    const roots: ContextEntry[] = []

    for (const entry of entries) {
      if (entry.parentId) {
        const existing = childMap.get(entry.parentId) ?? []
        existing.push(entry)
        childMap.set(entry.parentId, existing)
      } else {
        roots.push(entry)
      }
    }

    return { rootEntries: roots, childMap }
  }, [entries])

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
                <MarkdownRenderer content={entry.content} />
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

export default ContextBoardView
