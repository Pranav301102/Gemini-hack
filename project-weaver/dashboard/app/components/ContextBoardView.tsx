'use client'

import React, { useState, useMemo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import { WidgetGrid } from './WidgetRenderer'
import type { DashboardWidget } from './WidgetRenderer'
import {
  HiLightBulb,
  HiDocumentText,
  HiQuestionMarkCircle,
  HiAnnotation,
  HiSwitchHorizontal,
  HiX,
  HiReply,
} from 'react-icons/hi'

interface ContextEntry {
  id: string
  timestamp: string
  agent: string
  stage: string
  type: 'decision' | 'artifact' | 'question' | 'feedback' | 'handoff'
  title: string
  content: string
  parentId?: string
}

interface ContextBoardViewProps {
  entries: ContextEntry[]
  widgets: DashboardWidget[]
  selectedStage: string | null
  onStageFilter: (stage: string | null) => void
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  decision: { icon: HiLightBulb, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Decision' },
  artifact: { icon: HiDocumentText, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Artifact' },
  question: { icon: HiQuestionMarkCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Question' },
  feedback: { icon: HiAnnotation, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Feedback' },
  handoff: { icon: HiSwitchHorizontal, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Handoff' },
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

const STAGE_LABELS: Record<string, string> = {
  read: 'Read',
  architecture: 'Architecture',
  spec: 'Specification',
  stories: 'User Stories',
  approval: 'Approval',
  implementation: 'Implementation',
  testing: 'Testing',
  review: 'Code Review',
  ship: 'Ship',
}

const ContextBoardView: React.FC<ContextBoardViewProps> = ({ entries, widgets, selectedStage, onStageFilter }) => {
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
    if (selectedStage && e.stage !== selectedStage) return false
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

    return (
      <div key={entry.id} className={isChild ? 'ml-6' : ''}>
        <div
          className={`border-l-2 ${borderColor} bg-gray-900/50 rounded-r-lg overflow-hidden ${
            isChild ? 'border-l border-dashed' : ''
          }`}
        >
          {/* Thread indicator for child entries */}
          {isChild && (
            <div className="px-4 pt-2 flex items-center gap-1 text-[10px] text-gray-600">
              <HiReply className="w-3 h-3" />
              <span>Reply to thread</span>
            </div>
          )}

          {/* Entry header */}
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
                  <span className="text-[10px] text-gray-600">{entry.stage}</span>
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

          {/* Entry content */}
          {(isExpanded || !isLong) && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-gray-800 pt-3">
                <MarkdownRenderer content={entry.content} />
              </div>
            </div>
          )}

          {/* Preview for collapsed long entries */}
          {!isExpanded && isLong && (
            <div className="px-4 pb-3">
              <p className="text-[11px] text-gray-500 line-clamp-2">{entry.content.substring(0, 200)}...</p>
            </div>
          )}
        </div>

        {/* Render child entries (threaded) */}
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
      {/* Header with filters */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Context Board</h2>
            {selectedStage && (
              <button
                onClick={() => onStageFilter(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                {STAGE_LABELS[selectedStage] ?? selectedStage}
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

        {/* Type filters */}
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Widgets section */}
        {showWidgets && filteredWidgets.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <WidgetGrid
              widgets={filteredWidgets}
              className="grid-cols-1 lg:grid-cols-2"
            />
          </div>
        )}

        {/* Entries list */}
        {filteredEntries.length === 0 && filteredWidgets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            <div className="text-center">
              <p>No entries yet</p>
              <p className="mt-1 text-gray-700">Agent outputs will appear here</p>
            </div>
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
