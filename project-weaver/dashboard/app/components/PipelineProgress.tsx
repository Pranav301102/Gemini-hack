'use client'

import React, { useState } from 'react'
import { HiDocumentText, HiChip, HiCollection, HiSparkles } from 'react-icons/hi'
import EnrichmentPanel from './EnrichmentPanel'
import CodeExplainPopover from './CodeExplainPopover'

interface AgentState {
  role: string
  status: string
  currentTask?: string
  lastActive: string
  output?: string
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
  phase: string
  timestamp: string
  size: number
}

interface ApprovalState {
  status: 'pending' | 'approved' | 'changes-requested'
  reviewedAt?: string
  reviewedBy: string
  comments?: string
  revisionCount: number
}

interface PipelineProgressProps {
  phase: string | null
  agents: Record<string, AgentState> | null
  projectName: string
  projectDescription: string
  project: ProjectData | null
  files: TrackedFile[]
  approval?: ApprovalState | null
  geminiReady?: boolean
  projectPath?: string
  enrichmentProgress?: { totalItems: number; enrichedItems: number } | null
  // Legacy props for backwards compatibility
  pipeline?: unknown
  selectedStage?: string | null
  onStageClick?: (stage: string) => void
}

const AGENT_DISPLAY: Record<string, { label: string; fullName: string; color: string; bgColor: string }> = {
  'product-manager': { label: 'PM', fullName: 'Product Manager', color: 'bg-purple-500', bgColor: 'bg-purple-500/10' },
  'architect': { label: 'ARCH', fullName: 'Architect', color: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
  'developer': { label: 'DEV', fullName: 'Developer', color: 'bg-green-500', bgColor: 'bg-green-500/10' },
  'qa': { label: 'QA', fullName: 'QA Engineer', color: 'bg-yellow-500', bgColor: 'bg-yellow-500/10' },
  'code-reviewer': { label: 'CR', fullName: 'Code Reviewer', color: 'bg-red-500', bgColor: 'bg-red-500/10' },
}

const STATUS_CONFIG: Record<string, { textColor: string; dotColor: string; label: string }> = {
  idle: { textColor: 'text-gray-500', dotColor: 'bg-gray-500', label: 'Idle' },
  working: { textColor: 'text-blue-400', dotColor: 'bg-blue-400 animate-pulse', label: 'Working' },
  thinking: { textColor: 'text-purple-400', dotColor: 'bg-purple-400 animate-pulse', label: 'Thinking' },
  done: { textColor: 'text-green-400', dotColor: 'bg-green-500', label: 'Done' },
  error: { textColor: 'text-red-400', dotColor: 'bg-red-500', label: 'Error' },
  blocked: { textColor: 'text-yellow-400', dotColor: 'bg-yellow-500', label: 'Blocked' },
}

const PipelineProgress: React.FC<PipelineProgressProps> = ({
  phase, agents, projectName, projectDescription, project, files, approval,
  geminiReady, projectPath, enrichmentProgress,
}) => {
  const [showEnrichment, setShowEnrichment] = useState(false)
  const [explainFile, setExplainFile] = useState<string | null>(null)

  const activeAgents = agents
    ? Object.values(agents).filter(a => a.status === 'working' || a.status === 'thinking').length
    : 0

  return (
    <div className="h-full flex flex-col">
      {/* Project header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white truncate">{projectName || 'No Project'}</h2>
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{projectDescription || 'Initialize a project to get started'}</p>

        {project && (
          <div className="mt-3 space-y-1.5">
            {project.targetUsers && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] text-gray-600 flex-shrink-0">Users:</span>
                <span className="text-[10px] text-gray-400">{project.targetUsers}</span>
              </div>
            )}
            {project.deploymentTarget && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] text-gray-600 flex-shrink-0">Deploy:</span>
                <span className="text-[10px] text-gray-400">{project.deploymentTarget}</span>
              </div>
            )}
            {project.techStack && project.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {project.techStack.map((t, i) => (
                  <span key={i} className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {project.requirements.length > 0 && (
              <div className="mt-1">
                <span className="text-[10px] text-gray-600">
                  <HiCollection className="w-3 h-3 inline mr-1" />
                  {project.requirements.length} requirements
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick status bar */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${activeAgents > 0 ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-400">
              {activeAgents > 0 ? `${activeAgents} active` : 'Idle'}
            </span>
          </div>
          <span className="text-[10px] text-gray-600">{files.length} files</span>
          {phase && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 ml-auto">{phase}</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Agents */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agents</h3>
        <div className="space-y-1.5">
          {agents && Object.entries(agents).map(([role, state]) => {
            const display = AGENT_DISPLAY[role] ?? { label: role.toUpperCase(), fullName: role, color: 'bg-gray-500', bgColor: 'bg-gray-800' }
            const statusCfg = STATUS_CONFIG[state.status] ?? STATUS_CONFIG.idle
            const isActive = state.status === 'working' || state.status === 'thinking'

            return (
              <div
                key={role}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? `${display.bgColor} border border-gray-700` : 'bg-gray-900/50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full ${display.color} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                  {display.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-300">{display.fullName}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                    <span className={`text-[10px] ${statusCfg.textColor}`}>{statusCfg.label}</span>
                  </div>
                  {state.currentTask && (
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{state.currentTask}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Approval status */}
        {approval && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">Approval</h3>
            <div className="px-3 py-2.5 rounded-lg border border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${
                  approval.status === 'approved' ? 'bg-green-400' :
                  approval.status === 'changes-requested' ? 'bg-orange-400' :
                  'bg-yellow-400 animate-pulse'
                }`} />
                <span className={`font-medium ${
                  approval.status === 'approved' ? 'text-green-400' :
                  approval.status === 'changes-requested' ? 'text-orange-400' :
                  'text-yellow-400'
                }`}>
                  {approval.status === 'approved' ? 'Approved' :
                   approval.status === 'changes-requested' ? 'Changes Requested' :
                   'Pending Review'}
                </span>
                {approval.revisionCount > 0 && (
                  <span className="text-[10px] text-gray-600 ml-auto">rev {approval.revisionCount}</span>
                )}
              </div>
              {approval.comments && (
                <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">{approval.comments}</p>
              )}
            </div>
          </>
        )}

        {/* Enrich Codebase button */}
        {geminiReady && !!projectPath && (
          <div className="mt-4">
            <button
              onClick={() => setShowEnrichment(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs hover:bg-yellow-500/20 transition-colors"
            >
              <HiSparkles className="w-3.5 h-3.5" />
              Enrich Codebase
              {enrichmentProgress && enrichmentProgress.totalItems > 0 && (
                <span className="text-[10px] text-yellow-500/70 ml-1">
                  ({enrichmentProgress.enrichedItems}/{enrichmentProgress.totalItems})
                </span>
              )}
            </button>
          </div>
        )}

        {/* Files tracker */}
        {files.length > 0 && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">
              <HiDocumentText className="w-3 h-3 inline mr-1" />
              Files ({files.length})
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {files.map((file, i) => (
                <button
                  key={i}
                  onClick={() => geminiReady && projectPath ? setExplainFile(file.path) : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded bg-gray-900/50 text-[10px] text-left ${
                    geminiReady && projectPath ? 'hover:bg-gray-800/50 cursor-pointer' : ''
                  }`}
                  title={geminiReady ? 'Click for AI explanation' : undefined}
                >
                  <HiChip className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300 truncate flex-1 font-mono">{file.path}</span>
                  <span className="text-gray-600 flex-shrink-0">{(file.size / 1024).toFixed(1)}k</span>
                </button>
              ))}
            </div>
          </>
        )}

      </div>

      {/* Enrichment panel modal */}
      {showEnrichment && projectPath && (
        <EnrichmentPanel
          projectPath={projectPath}
          initialProgress={enrichmentProgress ?? undefined}
          onClose={() => setShowEnrichment(false)}
        />
      )}

      {/* Code explain popover */}
      {explainFile && projectPath && (
        <CodeExplainPopover
          filePath={explainFile}
          projectPath={projectPath}
          onClose={() => setExplainFile(null)}
        />
      )}
    </div>
  )
}

export default PipelineProgress
