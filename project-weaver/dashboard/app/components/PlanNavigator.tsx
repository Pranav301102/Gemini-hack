'use client'

import React, { useState } from 'react'
import {
  HiSearch,
  HiChevronDown,
  HiChevronRight,
  HiDocumentAdd,
  HiPencilAlt,
  HiCode,
  HiTrash,
  HiPuzzle,
  HiSparkles,
} from 'react-icons/hi'
import EnrichmentPanel from './EnrichmentPanel'

interface ChangeGroup {
  id: string
  name: string
  description: string
  agent: string
  changes: ProposedChange[]
  order: number
}

interface ProposedChange {
  id: string
  file: string
  changeType: string
  title: string
  priority: string
  complexity: string
}

interface FileChangeMap {
  file: string
  exists: boolean
  language: string
  changes: { changeId: string; changeType: string; summary: string }[]
  totalChanges: number
  maxPriority: string
}

interface PlanData {
  id: string
  summary: string
  goals: string[]
  changeGroups: ChangeGroup[]
  fileMap: FileChangeMap[]
}

interface AgentState {
  role: string
  status: string
  currentTask?: string
  lastActive: string
}

interface ProjectData {
  name: string
  description: string
  techStack?: string[]
}

interface PlanNavigatorProps {
  plan: PlanData | null
  project: ProjectData | null
  phase: string
  selectedGroup: string | null
  selectedFile: string | null
  onGroupSelect: (groupId: string | null) => void
  onFileSelect: (file: string | null) => void
  agents: Record<string, AgentState> | null
  geminiReady: boolean
  projectPath: string
  enrichmentProgress: { totalItems: number; enrichedItems: number } | null
}

const CHANGE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  create: { icon: HiDocumentAdd, color: 'text-green-400' },
  modify: { icon: HiPencilAlt, color: 'text-blue-400' },
  refactor: { icon: HiCode, color: 'text-yellow-400' },
  delete: { icon: HiTrash, color: 'text-red-400' },
  extend: { icon: HiPuzzle, color: 'text-purple-400' },
}

const PRIORITY_COLORS: Record<string, string> = {
  'must-have': 'bg-red-500/20 text-red-400',
  'should-have': 'bg-yellow-500/20 text-yellow-400',
  'nice-to-have': 'bg-gray-500/20 text-gray-400',
}

const PHASE_STEPS = [
  { key: 'read', label: 'Read' },
  { key: 'plan', label: 'Plan' },
  { key: 'ready', label: 'Ready' },
]

const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-600',
  thinking: 'bg-yellow-500 animate-pulse',
  working: 'bg-blue-500 animate-pulse',
  done: 'bg-green-500',
}

const PlanNavigator: React.FC<PlanNavigatorProps> = ({
  plan,
  project,
  phase,
  selectedGroup,
  selectedFile,
  onGroupSelect,
  onFileSelect,
  agents,
  geminiReady,
  projectPath,
  enrichmentProgress,
}) => {
  const [showFiles, setShowFiles] = useState(false)
  const [showEnrichment, setShowEnrichment] = useState(false)

  const totalChanges = plan?.changeGroups.reduce((sum, g) => sum + g.changes.length, 0) ?? 0
  const filesAffected = plan?.fileMap.length ?? 0

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Project header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white truncate">{project?.name ?? 'Project Weaver'}</h2>
        {project?.description && (
          <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{project.description}</p>
        )}
        {project?.techStack && project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.techStack.map((tech) => (
              <span key={tech} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Phase indicator */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-1">
          {PHASE_STEPS.map((step, i) => {
            const isActive = step.key === phase
            const isPast = PHASE_STEPS.findIndex(s => s.key === phase) > i
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <div className={`flex-1 h-px ${isPast ? 'bg-green-500' : 'bg-gray-700'}`} />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : isPast
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {isPast ? '\u2713' : i + 1}
                  </div>
                  <span className={`text-[9px] mt-1 ${isActive ? 'text-blue-400' : isPast ? 'text-green-400' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Plan overview */}
      {plan && (
        <>
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{plan.changeGroups.length}</div>
                <div className="text-[9px] text-gray-500">Groups</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{totalChanges}</div>
                <div className="text-[9px] text-gray-500">Changes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{filesAffected}</div>
                <div className="text-[9px] text-gray-500">Files</div>
              </div>
            </div>
          </div>

          {/* Change Groups */}
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Change Groups</h3>
            <div className="space-y-1">
              {plan.changeGroups
                .sort((a, b) => a.order - b.order)
                .map((group) => {
                  const isSelected = selectedGroup === group.id
                  return (
                    <button
                      key={group.id}
                      onClick={() => {
                        onGroupSelect(isSelected ? null : group.id)
                        onFileSelect(null)
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-500/10 border border-blue-500/30 text-white'
                          : 'hover:bg-gray-800/50 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{group.name}</span>
                        <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">{group.changes.length}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-gray-600">
                          {group.agent === 'architect' ? 'Arch' : 'PM'}
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* File Map */}
          <div className="px-4 py-3 border-b border-gray-800">
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-full"
            >
              {showFiles ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
              <span>File Map ({filesAffected})</span>
            </button>
            {showFiles && (
              <div className="mt-2 space-y-0.5 max-h-60 overflow-y-auto">
                {plan.fileMap.map((fm) => {
                  const isSelected = selectedFile === fm.file
                  const changeConfig = CHANGE_TYPE_CONFIG[fm.changes[0]?.changeType] ?? CHANGE_TYPE_CONFIG.modify
                  const ChangeIcon = changeConfig.icon
                  return (
                    <button
                      key={fm.file}
                      onClick={() => {
                        onFileSelect(isSelected ? null : fm.file)
                        onGroupSelect(null)
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-[10px] flex items-center gap-1.5 transition-colors ${
                        isSelected ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-gray-800/50 text-gray-400'
                      }`}
                    >
                      <ChangeIcon className={`w-3 h-3 flex-shrink-0 ${changeConfig.color}`} />
                      <span className="truncate flex-1">{fm.file}</span>
                      <span className="text-[9px] text-gray-600">{fm.totalChanges}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Agents */}
      {agents && (
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Agents</h3>
          <div className="space-y-1.5">
            {['architect', 'product-manager'].map((role) => {
              const agent = agents[role]
              if (!agent) return null
              return (
                <div key={role} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${AGENT_STATUS_COLORS[agent.status] ?? 'bg-gray-600'}`} />
                  <span className="text-[10px] text-gray-300">
                    {role === 'architect' ? 'Architect' : 'Product Manager'}
                  </span>
                  <span className="text-[9px] text-gray-600 ml-auto">{agent.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Enrichment */}
      {geminiReady && projectPath && showEnrichment && (
        <div className="px-4 py-3">
          <EnrichmentPanel
            projectPath={projectPath}
            initialProgress={enrichmentProgress ?? undefined}
            onClose={() => setShowEnrichment(false)}
          />
        </div>
      )}
      {geminiReady && projectPath && !showEnrichment && (
        <div className="px-4 py-3">
          <button
            onClick={() => setShowEnrichment(true)}
            className="w-full text-[10px] px-3 py-1.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            Enrich Index with AI
          </button>
        </div>
      )}
    </div>
  )
}

export default PlanNavigator
