'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import PipelineProgress from './components/PipelineProgress'
import AgentActivityFeed from './components/AgentActivityFeed'
import ContextBoardView from './components/ContextBoardView'
import ApprovalGate from './components/ApprovalGate'
import { HiRefresh, HiFolder } from 'react-icons/hi'
import type { DashboardWidget } from './components/WidgetRenderer'

interface WeaverEvent {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  agent?: string
  stage?: string
  action: string
  message: string
  data?: Record<string, unknown>
}

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

interface AgentState {
  role: string
  status: string
  currentTask?: string
  lastActive: string
}

interface TrackedFile {
  path: string
  agent: string
  stage: string
  timestamp: string
  size: number
}

interface PipelineData {
  currentStage: string
  stages: Record<string, {
    status: 'pending' | 'in-progress' | 'complete' | 'skipped'
    startedAt?: string
    completedAt?: string
    assignedAgent?: string
  }>
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

export default function Dashboard() {
  const [projectPath, setProjectPath] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<WeaverEvent[]>([])
  const [entries, setEntries] = useState<ContextEntry[]>([])
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [agents, setAgents] = useState<Record<string, AgentState> | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [files, setFiles] = useState<TrackedFile[]>([])
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (projectPath) params.set('path', projectPath)

      const res = await fetch(`/api/weaver?${params}`)
      const data = await res.json()

      if (data.success) {
        setProject(data.context.project)
        setPipeline(data.context.pipeline)
        setAgents(data.context.agents)
        setEntries(data.context.entries ?? [])
        setWidgets(data.context.widgets ?? [])
        setFiles(data.context.files ?? [])
        setEvents(data.events ?? [])
        setError(null)
      } else {
        setError(data.message)
      }
    } catch (err) {
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [projectPath])

  // Connect to SSE for real-time updates
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const params = new URLSearchParams()
    if (projectPath) params.set('path', projectPath)

    const es = new EventSource(`/api/weaver/events?${params}`)
    eventSourceRef.current = es

    es.onopen = () => setIsConnected(true)
    es.onerror = () => {
      setIsConnected(false)
      setTimeout(() => connectSSE(), 5000)
    }

    es.addEventListener('context', (event) => {
      try {
        const context = JSON.parse(event.data)
        setProject(context.project)
        setPipeline(context.pipeline)
        setAgents(context.agents)
        setEntries(context.entries ?? [])
        setWidgets(context.widgets ?? [])
        setFiles(context.files ?? [])
      } catch {
        // Skip malformed events
      }
    })

    es.addEventListener('log', (event) => {
      try {
        const logEvent = JSON.parse(event.data) as WeaverEvent
        setEvents(prev => [...prev, logEvent])
      } catch {
        // Skip malformed events
      }
    })

    return () => {
      es.close()
      setIsConnected(false)
    }
  }, [projectPath])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // SSE connection
  useEffect(() => {
    const cleanup = connectSSE()
    return cleanup
  }, [connectSSE])

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Top bar */}
      <header className="flex-shrink-0 h-12 border-b border-gray-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">PW</span>
          </div>
          <h1 className="text-sm font-bold text-white">Project Weaver</h1>
          <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded">AI Software Agency</span>
        </div>

        <div className="flex-1" />

        {/* Project path input */}
        <div className="flex items-center gap-2">
          <HiFolder className="w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="Project path (or leave empty for auto-detect)"
            className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 w-64 focus:outline-none focus:border-gray-600"
          />
          <button
            onClick={loadData}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
            title="Refresh"
          >
            <HiRefresh className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-900/20 border-b border-red-800 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Main 3-panel layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel: Pipeline Progress */}
        <div className="w-64 flex-shrink-0 border-r border-gray-800 overflow-hidden">
          <PipelineProgress
            pipeline={pipeline}
            agents={agents}
            projectName={project?.name ?? ''}
            projectDescription={project?.description ?? ''}
            project={project}
            files={files}
            selectedStage={selectedStage}
            onStageClick={(stage) => setSelectedStage(selectedStage === stage ? null : stage)}
          />
        </div>

        {/* Center panel: Context Board / Approval Gate */}
        <div className="flex-1 overflow-hidden border-r border-gray-800">
          {pipeline?.currentStage === 'approval' && pipeline?.stages?.approval?.status !== 'complete' ? (
            <div className="h-full overflow-y-auto">
              <ApprovalGate
                entries={entries}
                projectPath={projectPath}
                onApprovalComplete={loadData}
              />
            </div>
          ) : (
            <ContextBoardView
              entries={entries}
              widgets={widgets}
              selectedStage={selectedStage}
              onStageFilter={setSelectedStage}
            />
          )}
        </div>

        {/* Right panel: Activity Feed */}
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <AgentActivityFeed
            events={events}
            isConnected={isConnected}
          />
        </div>
      </main>
    </div>
  )
}
