'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  HiUserGroup,
  HiAnnotation,
  HiCheckCircle,
  HiExclamation,
  HiClock,
  HiShieldCheck,
  HiCode,
  HiFlag,
  HiLightningBolt,
  HiLockClosed,
  HiChat,
  HiCloudUpload,
  HiCloudDownload,
  HiStatusOnline,
  HiStatusOffline,
} from 'react-icons/hi'

// ─── Types ───

interface TeamMember {
  id: string
  name: string
  email: string
  firstSeen: string
  lastActive: string
  contributions: {
    scans: number
    annotations: number
    reviews: number
    builds: number
  }
}

interface TeamNote {
  id: string
  author: string
  authorEmail: string
  timestamp: string
  content: string
  category: 'general' | 'blocker' | 'decision' | 'handoff'
  resolved: boolean
}

interface TaskClaim {
  changeId: string
  changeTitle: string
  claimedBy: string
  claimedAt: string
  status: 'claimed' | 'in-progress' | 'done'
}

interface SyncEvent {
  timestamp: string
  member: string
  action: 'scan' | 'build' | 'implement' | 'review' | 'annotate'
  details: string
}

export interface TeamData {
  version: string
  members: TeamMember[]
  sharedNotes: TeamNote[]
  taskClaims: TaskClaim[]
  syncHistory: SyncEvent[]
}

export interface AnnotationData {
  id: string
  file?: string
  symbolPath?: string
  symbol?: string
  symbolType?: 'function' | 'class' | 'type' | 'variable' | 'module' | 'component'
  type?: string
  line?: number
  annotation?: string
  description?: string
  tags: string[]
  author?: string
  authorType?: 'agent' | 'human'
  createdBy?: string
  verified?: boolean
  verifiedBy?: string
  status?: string
  createdAt: string
  updatedAt?: string
  verifiedAt?: string
  confidence?: number
}

export interface AnnotationsData {
  version: string
  generatedAt?: string
  annotations: AnnotationData[]
  stats?: {
    total: number
    verified: number
    pending: number
    flagged: number
    byType: Record<string, number>
    avgConfidence: number
  }
}

interface TeamViewProps {
  team: TeamData | null
  annotations: AnnotationsData | null
  projectPath?: string
}

// ─── Sync Types ───

interface SyncStatus {
  hubOnline?: boolean
  remote?: string
  currentBranch?: string
  snapshot?: {
    exists: boolean
    meta?: { version: number; pushedBy: string; pushedAt: string; projectName: string; filesIncluded: string[] }
  } | null
  branches?: { branch: string; meta: { version: number; pushedAt: string } | null }[]
}

// ─── Helpers ───

const NOTE_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  general: { icon: HiChat, color: 'text-gray-400', bg: 'bg-gray-400/10' },
  blocker: { icon: HiExclamation, color: 'text-red-400', bg: 'bg-red-400/10' },
  decision: { icon: HiLightningBolt, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  handoff: { icon: HiFlag, color: 'text-blue-400', bg: 'bg-blue-400/10' },
}

const ACTION_COLORS: Record<string, string> = {
  scan: 'text-cyan-400',
  build: 'text-blue-400',
  implement: 'text-green-400',
  review: 'text-yellow-400',
  annotate: 'text-purple-400',
}

const CLAIM_STATUS: Record<string, { color: string; bg: string }> = {
  claimed: { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  'in-progress': { color: 'text-blue-400', bg: 'bg-blue-400/10' },
  done: { color: 'text-green-400', bg: 'bg-green-400/10' },
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-amber-500',
  'from-red-500 to-rose-500',
  'from-indigo-500 to-violet-500',
]

// ─── Component ───

const TeamView: React.FC<TeamViewProps> = ({ team, annotations, projectPath }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'annotations' | 'activity'>('members')
  const [annotationFilter, setAnnotationFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [annotationFileFilter, setAnnotationFileFilter] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Fetch sync status on mount
  useEffect(() => {
    if (!projectPath) return
    fetch(`/api/weaver/sync?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setSyncStatus(data)
      })
      .catch(() => setSyncStatus({ hubOnline: false }))
  }, [projectPath])

  const handleSync = useCallback(async (action: 'push' | 'pull') => {
    if (!projectPath || syncing) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/weaver/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, path: projectPath }),
      })
      const data = await res.json()
      if (data.error) {
        setSyncMessage(`❌ ${data.error}`)
      } else {
        setSyncMessage(action === 'push'
          ? `✅ Pushed v${data.version} (${data.filesWritten} files)`
          : `✅ Pulled (${data.filesWritten} files)`)
        // Refresh sync status
        const statusRes = await fetch(`/api/weaver/sync?path=${encodeURIComponent(projectPath)}`)
        const statusData = await statusRes.json()
        if (statusData.success) setSyncStatus(statusData)
      }
    } catch {
      setSyncMessage('❌ Cannot reach Weaver Hub')
    } finally {
      setSyncing(false)
    }
  }, [projectPath, syncing])

  const allAnnotations = annotations?.annotations ?? []
  const filteredAnnotations = allAnnotations.filter(a => {
    const isVerified = a.verified || a.status === 'verified'
    if (annotationFilter === 'verified' && !isVerified) return false
    if (annotationFilter === 'unverified' && isVerified) return false
    const file = a.file || a.symbolPath?.split(':')[0] || ''
    if (annotationFileFilter && file !== annotationFileFilter) return false
    return true
  })

  const annotationFiles = [...new Set(allAnnotations.map(a => a.file || a.symbolPath?.split(':')[0] || 'unknown'))]
  const verifiedCount = allAnnotations.filter(a => a.verified || a.status === 'verified').length

  if (!team && !annotations) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div>
          <HiUserGroup className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No team data yet</p>
          <p className="text-xs text-gray-600 mt-1">
            Commit <code className="bg-gray-800 px-1 rounded">.weaver/</code> to git to share with teammates
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'members' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <HiUserGroup className="w-3.5 h-3.5" />
          Team
          {team?.members && team.members.length > 0 && (
            <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded-full">{team.members.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('annotations')}
          className={`px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'annotations' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <HiAnnotation className="w-3.5 h-3.5" />
          Code Notes
          {allAnnotations.length > 0 && (
            <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded-full">{allAnnotations.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'activity' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <HiClock className="w-3.5 h-3.5" />
          Activity
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Members Tab ─── */}
        {activeTab === 'members' && (
          <div className="p-4 space-y-4">
            {/* Git sharing status */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <HiLockClosed className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-medium text-white">Shared via Git</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                The <code className="bg-gray-800 px-1 rounded">.weaver/</code> directory is committed to git.
                When teammates pull, they get your scanned index, plan, annotations, and agent memory — no re-scanning needed.
              </p>
            </div>

            {/* Weaver Hub Sync */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {syncStatus?.hubOnline ? (
                    <HiStatusOnline className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <HiStatusOffline className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-xs font-medium text-white">Weaver Hub</span>
                </div>
                {syncStatus?.currentBranch && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 font-mono">
                    {syncStatus.currentBranch}
                  </span>
                )}
              </div>

              {syncStatus?.snapshot?.exists && syncStatus.snapshot.meta && (
                <div className="text-[10px] text-gray-500 mb-2">
                  v{syncStatus.snapshot.meta.version} • pushed by <span className="text-gray-400">{syncStatus.snapshot.meta.pushedBy}</span> • {timeAgo(syncStatus.snapshot.meta.pushedAt)}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleSync('push')}
                  disabled={syncing || !syncStatus?.hubOnline}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[10px] font-medium transition-colors"
                >
                  <HiCloudUpload className="w-3.5 h-3.5" />
                  {syncing ? 'Syncing…' : 'Push'}
                </button>
                <button
                  onClick={() => handleSync('pull')}
                  disabled={syncing || !syncStatus?.hubOnline}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-[10px] font-medium transition-colors"
                >
                  <HiCloudDownload className="w-3.5 h-3.5" />
                  {syncing ? 'Syncing…' : 'Pull'}
                </button>
              </div>

              {syncMessage && (
                <div className="mt-2 text-[10px] text-gray-400">{syncMessage}</div>
              )}

              {/* Branch selector for pulling from other branches */}
              {syncStatus?.branches && syncStatus.branches.length > 1 && (
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Other Branches</div>
                  <div className="flex flex-wrap gap-1">
                    {syncStatus.branches
                      .filter(b => b.branch !== syncStatus.currentBranch)
                      .map(b => (
                        <span key={b.branch} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
                          {b.branch}{b.meta ? ` v${b.meta.version}` : ''}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-white">{team?.members.length ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Members</div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-white">{allAnnotations.length}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Code Notes</div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-400">{verifiedCount}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Verified</div>
              </div>
            </div>

            {/* Featured Team Members Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <HiUserGroup className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Active Team Members</h3>
                <span className="ml-auto text-xs text-gray-500">{team?.members.length ?? 0} members</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(team?.members ?? []).map((member, i) => {
                  const isRecent = (Date.now() - new Date(member.lastActive).getTime()) < 3600000 // Active in last hour
                  return (
                    <div key={member.id} className="flex items-start gap-2 bg-gray-900/80 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative`}>
                        {getInitials(member.name)}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${isRecent ? 'bg-green-500' : 'bg-gray-500'}`} title={isRecent ? 'Active' : 'Idle'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate mb-0.5">{member.name}</div>
                        <div className="text-[10px] text-gray-500 truncate mb-1.5">{member.email}</div>
                        <div className="flex flex-wrap gap-1">
                          {member.contributions.annotations > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 font-medium">
                              {member.contributions.annotations} notes
                            </span>
                          )}
                          {member.contributions.builds > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 font-medium">
                              {member.contributions.builds} builds
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {(team?.members ?? []).reduce((sum, m) => sum + m.contributions.annotations, 0)}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Total Annotations</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-400">
                      {(team?.members ?? []).reduce((sum, m) => sum + m.contributions.builds, 0)}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Builds</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-400">
                      {(team?.members ?? []).reduce((sum, m) => sum + m.contributions.reviews, 0)}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Reviews</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Member list */}
            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Contribution Details</h3>
              <div className="space-y-2">
                {(team?.members ?? []).map((member, i) => (
                  <div key={member.id} className="flex items-center gap-3 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{member.name}</div>
                      <div className="text-[10px] text-gray-500">{member.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-600">{timeAgo(member.lastActive)}</div>
                      <div className="flex gap-1.5 mt-1 justify-end">
                        {member.contributions.scans > 0 && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-400/10 text-cyan-400">{member.contributions.scans} scans</span>
                        )}
                        {member.contributions.reviews > 0 && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-400/10 text-green-400">{member.contributions.reviews} reviews</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Claims */}
            {team?.taskClaims && team.taskClaims.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Claimed Tasks</h3>
                <div className="space-y-1">
                  {team.taskClaims.map(claim => {
                    const status = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.claimed
                    return (
                      <div key={claim.changeId} className="flex items-center gap-2 px-3 py-2 bg-gray-900/30 rounded-lg">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>{claim.status}</span>
                        <span className="text-xs text-gray-300 flex-1 truncate">{claim.changeTitle}</span>
                        <span className="text-[10px] text-gray-600">{claim.claimedBy}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Shared Notes */}
            {team?.sharedNotes && team.sharedNotes.filter(n => !n.resolved).length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Team Notes</h3>
                <div className="space-y-2">
                  {team.sharedNotes.filter(n => !n.resolved).map(note => {
                    const config = NOTE_ICONS[note.category] ?? NOTE_ICONS.general
                    const Icon = config.icon
                    return (
                      <div key={note.id} className={`border-l-2 rounded-r-lg p-3 ${note.category === 'blocker' ? 'border-red-500 bg-red-500/5' : 'border-gray-600 bg-gray-900/30'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-3 h-3 ${config.color}`} />
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{note.category}</span>
                          <span className="text-[10px] text-gray-500 ml-auto">{note.author} · {timeAgo(note.timestamp)}</span>
                        </div>
                        <p className="text-xs text-gray-300">{note.content}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Annotations Tab ─── */}
        {activeTab === 'annotations' && (
          <div className="p-4 space-y-3">
            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setAnnotationFilter('all')}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                  annotationFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                All ({allAnnotations.length})
              </button>
              <button
                onClick={() => setAnnotationFilter('verified')}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                  annotationFilter === 'verified' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                <HiShieldCheck className="w-2.5 h-2.5" />
                Verified ({verifiedCount})
              </button>
              <button
                onClick={() => setAnnotationFilter('unverified')}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                  annotationFilter === 'unverified' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                Unverified ({allAnnotations.length - verifiedCount})
              </button>
            </div>

            {/* File filter */}
            {annotationFiles.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setAnnotationFileFilter(null)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                    !annotationFileFilter ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800/50 text-gray-500'
                  }`}
                >
                  All files
                </button>
                {annotationFiles.map(f => (
                  <button
                    key={f}
                    onClick={() => setAnnotationFileFilter(annotationFileFilter === f ? null : f)}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                      annotationFileFilter === f ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800/50 text-gray-500'
                    }`}
                  >
                    {f.split('/').pop()}
                  </button>
                ))}
              </div>
            )}

            {/* Annotations list */}
            {filteredAnnotations.length === 0 ? (
              <div className="text-center py-8">
                <HiAnnotation className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No code annotations yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Agents write notes about what functions do, how classes work, and design decisions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAnnotations.map(a => {
                  const symbol = a.symbol || a.symbolPath?.split(':').pop() || 'Unknown'
                  const file = a.file || a.symbolPath?.split(':')[0] || ''
                  const symbolType = a.symbolType || a.type || 'unknown'
                  const isVerified = a.verified || a.status === 'verified'
                  const author = a.author || (a.createdBy === 'agent' ? 'AI Agent' : a.createdBy || 'Unknown')
                  const authorType = a.authorType || (a.createdBy === 'agent' ? 'agent' : 'human')
                  const annotation = a.annotation || a.description || ''

                  return (
                  <div key={a.id} className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-800/50">
                      <div className="flex items-center gap-2">
                        <HiCode className={`w-3.5 h-3.5 flex-shrink-0 ${
                          symbolType === 'function' ? 'text-blue-400'
                          : symbolType === 'class' ? 'text-purple-400'
                          : symbolType === 'component' ? 'text-green-400'
                          : symbolType === 'type' ? 'text-cyan-400'
                          : 'text-gray-400'
                        }`} />
                        <span className="text-xs font-medium text-white font-mono">{symbol}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">{symbolType}</span>
                        {isVerified ? (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 flex items-center gap-0.5 ml-auto">
                            <HiShieldCheck className="w-2.5 h-2.5" />
                            Verified{a.verifiedBy ? ` by ${a.verifiedBy}` : ''}
                          </span>
                        ) : (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 ml-auto">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-gray-600 font-mono">{file}{a.line ? `:${a.line}` : ''}</span>
                        <span className="text-[9px] text-gray-700">·</span>
                        <span className="text-[9px] text-gray-600">
                          {authorType === 'agent' ? '🤖' : '👤'} {author}
                        </span>
                        {a.confidence && (
                          <>
                            <span className="text-[9px] text-gray-700">·</span>
                            <span className="text-[9px] text-gray-600">
                              {Math.round(a.confidence * 100)}% confidence
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{annotation}</p>
                      {a.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {a.tags.map(tag => (
                            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Activity Tab ─── */}
        {activeTab === 'activity' && (
          <div className="p-4">
            {(!team?.syncHistory || team.syncHistory.length === 0) ? (
              <div className="text-center py-8">
                <HiClock className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No team activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {[...team.syncHistory].reverse().map((event, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded hover:bg-gray-800/20 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-medium">{event.member}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded bg-gray-800 ${ACTION_COLORS[event.action] ?? 'text-gray-400'}`}>
                          {event.action}
                        </span>
                        <span className="text-[9px] text-gray-600 ml-auto flex-shrink-0">{timeAgo(event.timestamp)}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{event.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamView
