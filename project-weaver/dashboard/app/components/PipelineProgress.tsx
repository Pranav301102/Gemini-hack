'use client'

import React, { useState } from 'react'
import { HiCheck, HiClock, HiDocumentText, HiChip, HiCollection, HiUser, HiSparkles } from 'react-icons/hi'
import EnrichmentPanel from './EnrichmentPanel'
import CodeExplainPopover from './CodeExplainPopover'

interface StageInfo {
  status: 'pending' | 'in-progress' | 'complete' | 'skipped'
  startedAt?: string
  completedAt?: string
  assignedAgent?: string
}

interface PipelineData {
  currentStage: string
  stages: Record<string, StageInfo>
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
  requirements: string[]
  techStack?: string[]
  constraints?: string[]
  targetUsers?: string
  deploymentTarget?: string
}

interface TrackedFile {
  path: string
  agent: string
  stage: string
  timestamp: string
  size: number
}

interface PipelineProgressProps {
  pipeline: PipelineData | null
  agents: Record<string, AgentState> | null
  projectName: string
  projectDescription: string
  project: ProjectData | null
  files: TrackedFile[]
  selectedStage: string | null
  onStageClick: (stage: string) => void
  geminiReady?: boolean
  projectPath?: string
  enrichmentProgress?: { totalItems: number; enrichedItems: number } | null
}

const STAGE_ORDER = ['read', 'architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship']

const STAGE_LABELS: Record<string, string> = {
  read: 'Read',
  architecture: 'Architecture',
  spec: 'Spec',
  stories: 'Stories',
  approval: 'Approval',
  implementation: 'Implementation',
  testing: 'Testing',
  review: 'Review',
  ship: 'Ship',
}

const STAGE_AGENTS: Record<string, string> = {
  read: 'Architect',
  architecture: 'Architect',
  spec: 'Product Manager',
  stories: 'Product Manager',
  approval: 'User',
  implementation: 'Developer',
  testing: 'QA Engineer',
  review: 'Code Reviewer',
  ship: 'Developer',
}

const AGENT_DISPLAY: Record<string, { label: string; color: string }> = {
  'product-manager': { label: 'PM', color: 'bg-purple-500' },
  'architect': { label: 'ARCH', color: 'bg-blue-500' },
  'developer': { label: 'DEV', color: 'bg-green-500' },
  'qa': { label: 'QA', color: 'bg-yellow-500' },
  'code-reviewer': { label: 'CR', color: 'bg-red-500' },
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-gray-500',
  working: 'text-blue-400',
  thinking: 'text-purple-400',
  done: 'text-green-400',
  error: 'text-red-400',
  blocked: 'text-yellow-400',
}

const PipelineProgress: React.FC<PipelineProgressProps> = ({
  pipeline, agents, projectName, projectDescription, project, files, selectedStage, onStageClick,
  geminiReady, projectPath, enrichmentProgress,
}) => {
  const [showEnrichment, setShowEnrichment] = useState(false)
  const [explainFile, setExplainFile] = useState<string | null>(null)

  const completedCount = pipeline
    ? Object.values(pipeline.stages).filter(s => s.status === 'complete').length
    : 0
  const totalStages = STAGE_ORDER.length
  const progressPct = Math.round((completedCount / totalStages) * 100)

  return (
    <div className="h-full flex flex-col">
      {/* Project header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white truncate">{projectName || 'No Project'}</h2>
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{projectDescription || 'Initialize a project to get started'}</p>

        {/* Project details */}
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

      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Pipeline Progress</span>
          <span className="text-xs font-mono text-gray-300">{completedCount}/{totalStages}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Pipeline stages - CLICKABLE */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stages</h3>
        <div className="space-y-1">
          {STAGE_ORDER.map((stage, idx) => {
            const info = pipeline?.stages[stage]
            const status = info?.status ?? 'pending'
            const isCurrent = pipeline?.currentStage === stage
            const isSelected = selectedStage === stage

            return (
              <button
                key={stage}
                onClick={() => onStageClick(stage)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : isCurrent
                      ? 'bg-gray-800 border border-gray-700'
                      : 'hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                {/* Status icon */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'complete' ? 'bg-green-500/20 text-green-400' :
                  status === 'in-progress' && stage === 'approval' ? 'bg-orange-500/20 text-orange-400' :
                  status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-800 text-gray-600'
                }`}>
                  {status === 'complete' ? <HiCheck className="w-3 h-3" /> :
                   status === 'in-progress' && stage === 'approval' ? <HiUser className="w-3 h-3 animate-pulse" /> :
                   status === 'in-progress' ? <HiClock className="w-3 h-3 animate-pulse" /> :
                   stage === 'approval' ? <HiUser className="w-3 h-3" /> :
                   <span className="text-[10px]">{idx + 1}</span>}
                </div>

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      isSelected ? 'text-blue-400' :
                      status === 'complete' ? 'text-green-400' :
                      status === 'in-progress' ? 'text-yellow-400' :
                      'text-gray-500'
                    }`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-gray-600 text-[10px]">{STAGE_AGENTS[stage]}</span>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  status === 'complete' ? 'bg-green-500/10 text-green-400' :
                  status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-gray-800 text-gray-600'
                }`}>
                  {status}
                </span>
              </button>
            )
          })}
        </div>

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

        {/* Agent statuses */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">Agents</h3>
        <div className="space-y-2">
          {agents && Object.entries(agents).map(([role, state]) => {
            const display = AGENT_DISPLAY[role] ?? { label: role.toUpperCase(), color: 'bg-gray-500' }
            return (
              <div key={role} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/50">
                <div className={`w-6 h-6 rounded-full ${display.color} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                  {display.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${STATUS_COLORS[state.status] ?? 'text-gray-400'}`}>
                    {state.status}
                  </div>
                  {state.currentTask && (
                    <div className="text-[10px] text-gray-500 truncate">{state.currentTask}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
