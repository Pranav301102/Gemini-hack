'use client'

import React, { useState, useEffect } from 'react'
import {
  HiClock,
  HiUser,
  HiRefresh,
  HiCheckCircle,
  HiExclamationCircle,
  HiChevronDown,
  HiChevronRight,
  HiCode,
} from 'react-icons/hi'

interface GitCommit {
  hash: string
  author: string
  date: string
  message: string
  branch: string
}

interface GitBranch {
  name: string
  current: boolean
  lastCommit: string
}

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  modified: number
  untracked: number
  staged: number
}

interface GitVersionManagerProps {
  projectPath?: string
  onRefresh?: () => void
}

export default function GitVersionManager({ projectPath, onRefresh }: GitVersionManagerProps) {
  const [status, setStatus] = useState<GitStatus | null>({
    branch: 'main',
    ahead: 0,
    behind: 0,
    modified: 3,
    untracked: 1,
    staged: 2,
  })
  const [commits, setCommits] = useState<GitCommit[]>([
    {
      hash: 'c80dbdf',
      author: 'Sarah Chen',
      date: '2 hours ago',
      message: 'Add Vercel configuration for Next.js deployment',
      branch: 'main',
    },
    {
      hash: '59892b7',
      author: 'Marcus Rodriguez',
      date: '5 hours ago',
      message: 'feat: add app runner, approval, docs, and shell command tools',
      branch: 'main',
    },
    {
      hash: 'f97fa2e',
      author: 'Jordan Kim',
      date: '1 day ago',
      message: 'feat(planner): implement planning tools for project management',
      branch: 'main',
    },
    {
      hash: '7bf80a9',
      author: 'Aisha Patel',
      date: '1 day ago',
      message: 'feat: add read_project tool to scan codebase and detect structure',
      branch: 'main',
    },
    {
      hash: '428facb',
      author: 'Sarah Chen',
      date: '2 days ago',
      message: 'Init project with MCP server setup',
      branch: 'main',
    },
  ])
  const [branches, setBranches] = useState<GitBranch[]>([
    { name: 'main', current: true, lastCommit: 'c80dbdf' },
    { name: 'feature/team-sync', current: false, lastCommit: 'a1b2c3d' },
    { name: 'feature/dashboard-ui', current: false, lastCommit: 'e4f5g6h' },
  ])
  const [showCommits, setShowCommits] = useState(true)
  const [showBranches, setShowBranches] = useState(false)

  const handleRefresh = () => {
    if (onRefresh) onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Git Status Summary */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HiCode className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">{status?.branch || 'main'}</span>
            {status && status.ahead > 0 && (
              <span className="text-xs bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">
                ↑{status.ahead}
              </span>
            )}
            {status && status.behind > 0 && (
              <span className="text-xs bg-orange-900/30 text-orange-400 px-1.5 py-0.5 rounded">
                ↓{status.behind}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Refresh git status"
          >
            <HiRefresh className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <HiCheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span className="text-gray-400">Staged:</span>
            <span className="text-white font-medium">{status?.staged || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HiExclamationCircle className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-gray-400">Modified:</span>
            <span className="text-white font-medium">{status?.modified || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HiExclamationCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-400">Untracked:</span>
            <span className="text-white font-medium">{status?.untracked || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent Commits */}
      <div>
        <button
          onClick={() => setShowCommits(!showCommits)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase mb-2 hover:text-gray-300"
        >
          {showCommits ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
          Recent Commits ({commits.length})
        </button>
        {showCommits && (
          <div className="space-y-1.5">
            {commits.map(commit => (
              <div
                key={commit.hash}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-2.5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <code className="text-xs font-mono text-blue-400 flex-shrink-0">
                    {commit.hash}
                  </code>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 mb-1 line-clamp-2">
                      {commit.message}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <HiUser className="w-3 h-3" />
                        <span>{commit.author}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HiClock className="w-3 h-3" />
                        <span>{commit.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branches */}
      <div>
        <button
          onClick={() => setShowBranches(!showBranches)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase mb-2 hover:text-gray-300"
        >
          {showBranches ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
          Branches ({branches.length})
        </button>
        {showBranches && (
          <div className="space-y-1">
            {branches.map(branch => (
              <div
                key={branch.name}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                  branch.current
                    ? 'bg-blue-900/20 border border-blue-800/30'
                    : 'bg-gray-900/50 border border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <HiCode className={`w-3.5 h-3.5 ${branch.current ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className={branch.current ? 'text-blue-400 font-medium' : 'text-gray-400'}>
                    {branch.name}
                  </span>
                  {branch.current && (
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                      current
                    </span>
                  )}
                </div>
                <code className="text-[10px] text-gray-500 font-mono">
                  {branch.lastCommit}
                </code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
