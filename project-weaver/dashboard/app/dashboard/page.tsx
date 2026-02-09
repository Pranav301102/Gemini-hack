'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import PlanNavigator from '../components/PlanNavigator'
import PlanDetailView from '../components/PlanDetailView'
import AgentActivityFeed from '../components/AgentActivityFeed'
import ContextBoardView from '../components/ContextBoardView'
import CodeIntelView from '../components/CodeIntelView'
import type { CodeMaps } from '../components/CodeIntelView'
import DocsBrowser from '../components/DocsBrowser'
import type { DocsCollection } from '../components/DocsBrowser'
import SettingsModal from '../components/SettingsModal'
import GeminiKeyIndicator from '../components/GeminiKeyIndicator'
import ChatPanel from '../components/ChatPanel'
import TeamView from '../components/TeamView'
import type { TeamData, AnnotationsData } from '../components/TeamView'
import { HiRefresh, HiFolder, HiChat } from 'react-icons/hi'
import { getGeminiKey } from '../lib/gemini-key'
import type { DashboardWidget } from '../components/WidgetRenderer'

interface WeaverEvent {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  agent?: string
  phase?: string
  action: string
  message: string
  data?: Record<string, unknown>
}

interface ContextEntry {
  id: string
  timestamp: string
  agent: string
  phase?: string
  stage?: string // legacy support
  type: 'brainstorm' | 'proposal' | 'decision' | 'artifact' | 'question' | 'memory-map'
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
  phase?: string
  timestamp: string
  size: number
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PlanData {
  id: string
  summary: string
  goals: string[]
  approach: string
  changeGroups: any[]
  architectureNotes: string
  riskAssessment: string
  fileMap: any[]
  discussion: any[]
  diagrams: any[]
}

export default function Dashboard() {
  const [projectPath, setProjectPath] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<WeaverEvent[]>([])
  const [entries, setEntries] = useState<ContextEntry[]>([])
  const [phase, setPhase] = useState<string>('read')
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [agents, setAgents] = useState<Record<string, AgentState> | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [files, setFiles] = useState<TrackedFile[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)
  const [codeMaps, setCodeMaps] = useState<CodeMaps | null>(null)
  const [docs, setDocs] = useState<DocsCollection | null>(null)
  const [team, setTeam] = useState<TeamData | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationsData | null>(null)
  const [centerView, setCenterView] = useState<'context' | 'code-intel' | 'plan' | 'docs' | 'team'>('context')
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Gemini state
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [geminiReady, setGeminiReady] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState<{ totalItems: number; enrichedItems: number } | null>(null)
  const [approval, setApproval] = useState<any>(null)

  // Check for Gemini key and demo mode on mount
  useEffect(() => {
    setGeminiReady(!!getGeminiKey())
    // Check if demo mode is enabled
    const params = new URLSearchParams(window.location.search)
    const demo = params.get('demo') === 'true'
    setIsDemoMode(demo)

    // Load demo data for team if in demo mode
    if (demo) {
      setTeam({
        version: '1.0.0',
        members: [
          {
            id: 'dev-1',
            name: 'Sarah Chen',
            email: 'sarah@example.com',
            firstSeen: '2026-02-01T09:00:00.000Z',
            lastActive: new Date(Date.now() - 15 * 60000).toISOString(),
            contributions: { scans: 8, annotations: 45, reviews: 12, builds: 23 }
          },
          {
            id: 'dev-2',
            name: 'Marcus Rodriguez',
            email: 'marcus@example.com',
            firstSeen: '2026-02-01T09:00:00.000Z',
            lastActive: new Date(Date.now() - 45 * 60000).toISOString(),
            contributions: { scans: 12, annotations: 38, reviews: 15, builds: 27 }
          },
          {
            id: 'dev-3',
            name: 'Aisha Patel',
            email: 'aisha@example.com',
            firstSeen: '2026-02-02T10:30:00.000Z',
            lastActive: new Date(Date.now() - 10 * 60000).toISOString(),
            contributions: { scans: 5, annotations: 28, reviews: 34, builds: 11 }
          },
          {
            id: 'dev-4',
            name: 'Jordan Kim',
            email: 'jordan@example.com',
            firstSeen: '2026-02-01T09:00:00.000Z',
            lastActive: new Date(Date.now() - 100 * 60000).toISOString(),
            contributions: { scans: 6, annotations: 45, reviews: 8, builds: 19 }
          }
        ],
        sharedNotes: [
          {
            id: 'note-1',
            author: 'Marcus Rodriguez',
            authorEmail: 'marcus@example.com',
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            content: 'Updated the architecture to use WatermelonDB for offline-first sync. Please review the proposed changes in the planning phase.',
            category: 'decision',
            resolved: false
          },
          {
            id: 'note-2',
            author: 'Aisha Patel',
            authorEmail: 'aisha@example.com',
            timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
            content: 'Found a bug in the todo update endpoint - missing validation for groupId. Adding to test cases.',
            category: 'blocker',
            resolved: false
          }
        ],
        taskClaims: [
          {
            changeId: 'backend-schema-overhaul',
            changeTitle: 'Advanced Data Model & Database Migration',
            claimedBy: 'Marcus Rodriguez',
            claimedAt: new Date(Date.now() - 120 * 60000).toISOString(),
            status: 'in-progress'
          },
          {
            changeId: 'natural-language-capture',
            changeTitle: 'Natural Language Task Parser',
            claimedBy: 'Sarah Chen',
            claimedAt: new Date(Date.now() - 90 * 60000).toISOString(),
            status: 'claimed'
          }
        ],
        syncHistory: [
          {
            timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
            member: 'Aisha Patel',
            action: 'review',
            details: 'Reviewed and verified 5 code annotations for backend controllers'
          },
          {
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            member: 'Marcus Rodriguez',
            action: 'annotate',
            details: 'Added architectural notes and diagrams to context board'
          },
          {
            timestamp: new Date(Date.now() - 100 * 60000).toISOString(),
            member: 'Jordan Kim',
            action: 'scan',
            details: 'Scanned codebase and generated project structure index'
          },
          {
            timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
            member: 'Sarah Chen',
            action: 'implement',
            details: 'Implemented React components for todo list features'
          }
        ]
      })

      setAnnotations({
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        annotations: [
          {
            id: 'ann-1',
            symbolPath: 'dashboard/app/components/PlanNavigator.tsx:PlanNavigator',
            type: 'component',
            description: 'Main navigation component for the planning phase. Displays change groups, files, and approval status. Handles user interactions for group/file selection.',
            tags: ['UI', 'Navigation', 'Planning'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 300 * 60000).toISOString(),
            verifiedBy: 'Sarah Chen',
            verifiedAt: new Date(Date.now() - 200 * 60000).toISOString(),
            status: 'verified',
            confidence: 0.92
          },
          {
            id: 'ann-2',
            symbolPath: 'src/tools/planning/planner.ts:generatePlan',
            type: 'function',
            description: 'Core planning function that analyzes project requirements and generates a structured implementation plan with change groups, file maps, and architectural diagrams.',
            tags: ['Planning', 'Core Logic', 'AI Agent'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 280 * 60000).toISOString(),
            verifiedBy: 'Marcus Rodriguez',
            verifiedAt: new Date(Date.now() - 45 * 60000).toISOString(),
            status: 'verified',
            confidence: 0.95
          },
          {
            id: 'ann-3',
            symbolPath: 'dashboard/app/components/TeamView.tsx:TeamView',
            type: 'component',
            description: 'Displays team collaboration information including members, sync history, and annotation statistics. Shows git-based team sharing status.',
            tags: ['UI', 'Team Collaboration', 'Dashboard'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 150 * 60000).toISOString(),
            status: 'pending',
            confidence: 0.88
          },
          {
            id: 'ann-4',
            symbolPath: 'src/tools/context/writer.ts:writeContextEntry',
            type: 'function',
            description: 'Writes entries to the shared context board. Used by all agents to persist their thoughts, decisions, and artifacts to the .weaver/context.json file.',
            tags: ['Context Management', 'Persistence', 'Core'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 270 * 60000).toISOString(),
            verifiedBy: 'Marcus Rodriguez',
            verifiedAt: new Date(Date.now() - 40 * 60000).toISOString(),
            status: 'verified',
            confidence: 0.97
          },
          {
            id: 'ann-5',
            symbolPath: 'hub/src/routes/sync.ts:handlePush',
            type: 'function',
            description: 'Handles push synchronization from team members. Validates incoming annotations and merges them into the central hub repository.',
            tags: ['Hub', 'Sync', 'Team Collaboration'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 220 * 60000).toISOString(),
            verifiedBy: 'Aisha Patel',
            verifiedAt: new Date(Date.now() - 10 * 60000).toISOString(),
            status: 'verified',
            confidence: 0.90
          },
          {
            id: 'ann-6',
            symbolPath: 'src/tools/indexing/ast-parser.ts:parseCodebase',
            type: 'function',
            description: 'Uses tree-sitter to parse source files and extract AST information including functions, classes, variables, and dependencies. Foundation for code intelligence features.',
            tags: ['Indexing', 'AST', 'Tree-sitter'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 290 * 60000).toISOString(),
            status: 'pending',
            confidence: 0.85
          },
          {
            id: 'ann-7',
            symbolPath: 'dashboard/app/components/CodeIntelView.tsx:ClassMapView',
            type: 'component',
            description: 'Renders the class/interface hierarchy with relationship diagrams. Allows developers to explore code structure visually.',
            tags: ['UI', 'Code Intelligence', 'Visualization'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 140 * 60000).toISOString(),
            verifiedBy: 'Sarah Chen',
            verifiedAt: new Date(Date.now() - 30 * 60000).toISOString(),
            status: 'verified',
            confidence: 0.91
          },
          {
            id: 'ann-8',
            symbolPath: 'src/agents/architect/index.ts:analyzeArchitecture',
            type: 'function',
            description: 'Architect agent\'s main analysis function. Examines codebase structure, identifies patterns, and proposes architectural improvements.',
            tags: ['Agent', 'Architecture', 'Analysis'],
            createdBy: 'agent',
            createdAt: new Date(Date.now() - 200 * 60000).toISOString(),
            status: 'pending',
            confidence: 0.87
          }
        ],
        stats: {
          total: 156,
          verified: 89,
          pending: 34,
          flagged: 33,
          byType: {
            function: 78,
            class: 23,
            component: 31,
            module: 12,
            interface: 12
          },
          avgConfidence: 0.89
        }
      })
    }
  }, [])

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (projectPath) params.set('path', projectPath)

      const res = await fetch(`/api/weaver?${params}`)
      const data = await res.json()

      if (data.success) {
        setProject(data.context.project)
        setPhase(data.context.phase ?? 'read')
        setPlan(data.plan ?? data.context.plan ?? null)
        setAgents(data.context.agents)
        setEntries(data.context.entries ?? [])
        setWidgets(data.context.widgets ?? [])
        setFiles(data.context.files ?? [])
        setEvents(data.events ?? [])
        if (data.enrichmentProgress) setEnrichmentProgress(data.enrichmentProgress)
        if (data.codeMaps) setCodeMaps(data.codeMaps)
        if (data.docs) setDocs(data.docs)
        if (data.team) setTeam(data.team)
        if (data.annotations) setAnnotations(data.annotations)
        if (data.approval) setApproval(data.approval)
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
        setPhase(context.phase ?? 'read')
        setPlan(context.plan ?? null)
        setAgents(context.agents)
        setEntries(context.entries ?? [])
        setWidgets(context.widgets ?? [])
        setFiles(context.files ?? [])
        if (context.approval !== undefined) setApproval(context.approval ?? null)
      } catch {
        // Skip malformed events
      }
    })

    es.addEventListener('log', (event) => {
      try {
        const logEvent = JSON.parse(event.data) as WeaverEvent
        setEvents(prev => {
          // Deduplicate by event ID
          if (prev.some(e => e.id === logEvent.id)) return prev
          return [...prev, logEvent]
        })
      } catch {
        // Skip malformed events
      }
    })

    es.addEventListener('docs', (event) => {
      try {
        const docsData = JSON.parse(event.data) as DocsCollection
        setDocs(docsData)
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

  // When selecting a group, clear file selection and vice versa
  const handleGroupSelect = (groupId: string | null) => {
    setSelectedGroup(groupId)
    setSelectedFile(null)
  }

  const handleFileSelect = (file: string | null) => {
    setSelectedFile(file)
    setSelectedGroup(null)
  }

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

        {/* Gemini key indicator */}
        <GeminiKeyIndicator hasKey={geminiReady} onClick={() => setShowSettings(true)} />

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
        {/* Left panel: Plan Navigator */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-hidden">
          <PlanNavigator
            plan={plan}
            project={project}
            phase={phase}
            selectedGroup={selectedGroup}
            selectedFile={selectedFile}
            onGroupSelect={handleGroupSelect}
            onFileSelect={handleFileSelect}
            agents={agents}
            geminiReady={geminiReady}
            projectPath={projectPath}
            enrichmentProgress={enrichmentProgress}
            approval={approval}
          />
        </div>

        {/* Center panel: Context Board / Code Intel / Plan */}
        <div className="flex-1 overflow-hidden border-r border-gray-800 flex flex-col">
          {/* Center panel tabs */}
          <div className="flex-shrink-0 border-b border-gray-800 px-4 flex gap-1">
            <button
              onClick={() => setCenterView('context')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                centerView === 'context'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Context Board
            </button>
            <button
              onClick={() => setCenterView('code-intel')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                centerView === 'code-intel'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Code Intelligence
              {codeMaps && (
                <span className="ml-1 text-[10px] bg-gray-800 text-gray-500 px-1 rounded">
                  {codeMaps.classMap.classes.length + codeMaps.moduleMap.modules.length}
                </span>
              )}
            </button>
            {plan && (
              <button
                onClick={() => setCenterView('plan')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  centerView === 'plan'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                Plan
              </button>
            )}
            {docs && docs.docs.length > 0 && (
              <button
                onClick={() => setCenterView('docs')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  centerView === 'docs'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                Docs
                <span className="ml-1 text-[10px] bg-gray-800 text-gray-500 px-1 rounded">
                  {docs.docs.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setCenterView('team')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                centerView === 'team'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Team
              {(team?.members?.length ?? 0) > 0 && (
                <span className="ml-1 text-[10px] bg-gray-800 text-gray-500 px-1 rounded">
                  {team!.members.length}
                </span>
              )}
            </button>
          </div>

          {/* Center panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {centerView === 'context' && (
              <ContextBoardView
                entries={entries}
                widgets={widgets}
                selectedPhase={selectedPhase}
                onPhaseFilter={setSelectedPhase}
                projectPath={projectPath}
                geminiReady={geminiReady}
                project={project}
                phase={phase}
                files={files}
                plan={plan}
              />
            )}
            {centerView === 'code-intel' && (
              <CodeIntelView codeMaps={codeMaps} />
            )}
            {centerView === 'plan' && plan && (
              <PlanDetailView
                plan={plan}
                selectedGroup={selectedGroup}
                selectedFile={selectedFile}
                widgets={widgets}
              />
            )}
            {centerView === 'docs' && (
              <DocsBrowser docs={docs} />
            )}
            {centerView === 'team' && (
              <TeamView team={team} annotations={annotations} projectPath={projectPath} />
            )}
          </div>
        </div>

        {/* Right panel: Activity Feed */}
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <AgentActivityFeed
            events={events}
            isConnected={isConnected}
          />
        </div>
      </main>

      {/* Floating chat button */}
      {geminiReady && !showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 z-30 w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all hover:scale-105"
          title="Chat with codebase"
        >
          <HiChat className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Chat panel */}
      <ChatPanel
        projectPath={projectPath}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onKeyChange={(hasKey) => setGeminiReady(hasKey)}
        />
      )}
    </div>
  )
}
