'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  HiInformationCircle,
  HiExclamation,
  HiXCircle,
  HiCode,
  HiFilter,
  HiX,
} from 'react-icons/hi'

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

interface AgentActivityFeedProps {
  events: WeaverEvent[]
  isConnected: boolean
}

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  info: { icon: HiInformationCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Info' },
  warn: { icon: HiExclamation, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Warn' },
  error: { icon: HiXCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Error' },
  debug: { icon: HiCode, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Debug' },
}

const AGENT_COLORS: Record<string, string> = {
  'product-manager': 'text-purple-400',
  'architect': 'text-blue-400',
  'developer': 'text-green-400',
  'qa': 'text-yellow-400',
  'code-reviewer': 'text-red-400',
}

const AGENT_LABELS: Record<string, string> = {
  'product-manager': 'PM',
  'architect': 'Arch',
  'developer': 'Dev',
  'qa': 'QA',
  'code-reviewer': 'CR',
}

const AgentActivityFeed: React.FC<AgentActivityFeedProps> = ({ events, isConnected }) => {
  const feedRef = useRef<HTMLDivElement>(null)
  const [agentFilter, setAgentFilter] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events])

  const filteredEvents = events.filter(e => {
    if (agentFilter && e.agent !== agentFilter) return false
    if (levelFilter && e.level !== levelFilter) return false
    return true
  })

  const hasFilters = agentFilter !== null || levelFilter !== null

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Activity Feed</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded transition-colors ${
                hasFilters ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Filters"
            >
              <HiFilter className="w-3.5 h-3.5" />
            </button>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] text-gray-500">{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 space-y-2">
            {/* Agent filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-600 w-10">Agent:</span>
              <button
                onClick={() => setAgentFilter(null)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  agentFilter === null ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-500'
                }`}
              >
                All
              </button>
              {Object.entries(AGENT_LABELS).map(([agent, label]) => (
                <button
                  key={agent}
                  onClick={() => setAgentFilter(agentFilter === agent ? null : agent)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    agentFilter === agent
                      ? `${AGENT_COLORS[agent]} bg-gray-700`
                      : 'bg-gray-800/50 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Level filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-600 w-10">Level:</span>
              <button
                onClick={() => setLevelFilter(null)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  levelFilter === null ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-500'
                }`}
              >
                All
              </button>
              {Object.entries(LEVEL_CONFIG).map(([level, config]) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    levelFilter === level
                      ? `${config.color} ${config.bg}`
                      : 'bg-gray-800/50 text-gray-500'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={() => { setAgentFilter(null); setLevelFilter(null) }}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <HiX className="w-3 h-3" />
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Events list */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            <div className="text-center">
              <p>No activity yet</p>
              <p className="mt-1 text-gray-700">Events will appear here as agents work</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {filteredEvents.map((event) => {
              const config = LEVEL_CONFIG[event.level] ?? LEVEL_CONFIG.info
              const Icon = config.icon
              const agentColor = event.agent ? AGENT_COLORS[event.agent] ?? 'text-gray-400' : 'text-gray-500'

              return (
                <div key={event.id} className="px-4 py-2.5 hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-start gap-2">
                    {/* Level icon */}
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Agent badge */}
                        {event.agent && (
                          <span className={`text-[10px] font-medium ${agentColor}`}>
                            [{AGENT_LABELS[event.agent] ?? event.agent}]
                          </span>
                        )}
                        {/* Stage badge */}
                        {event.stage && (
                          <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                            {event.stage}
                          </span>
                        )}
                        {/* Timestamp */}
                        <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-xs text-gray-300 mt-0.5 break-words">
                        {event.message}
                      </p>

                      {/* Action tag */}
                      <span className={`inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                        {event.action}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer with event count */}
      <div className="px-4 py-2 border-t border-gray-800 text-[10px] text-gray-600">
        {hasFilters
          ? `${filteredEvents.length} of ${events.length} events`
          : `${events.length} event${events.length !== 1 ? 's' : ''}`
        }
      </div>
    </div>
  )
}

export default AgentActivityFeed
