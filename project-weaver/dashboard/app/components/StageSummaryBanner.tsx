'use client'

import React, { useState } from 'react'
import { HiSparkles, HiChevronDown, HiChevronUp } from 'react-icons/hi'
import { getGeminiHeaders } from '../lib/gemini-key'
import MarkdownRenderer from './MarkdownRenderer'

interface StageSummaryBannerProps {
  stage: string
  projectPath: string
  geminiReady: boolean
}

const STAGE_LABELS: Record<string, string> = {
  read: 'Read', architecture: 'Architecture', spec: 'Specification',
  stories: 'User Stories', approval: 'Approval', implementation: 'Implementation',
  testing: 'Testing', review: 'Code Review', ship: 'Ship',
}

const StageSummaryBanner: React.FC<StageSummaryBannerProps> = ({ stage, projectPath, geminiReady }) => {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getGeminiHeaders() },
        body: JSON.stringify({ projectPath, stage }),
      })
      const data = await res.json()
      if (data.summary) {
        setSummary(data.summary)
      } else {
        setError(data.error || 'No summary generated')
      }
    } catch {
      setError('Failed to generate summary')
    }
    setIsLoading(false)
  }

  if (!geminiReady) return null

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/30">
      {summary ? (
        <>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors"
          >
            <HiSparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] font-medium text-gray-300 flex-1 text-left">
              AI Summary: {STAGE_LABELS[stage] || stage}
            </span>
            {isCollapsed ? <HiChevronDown className="w-3 h-3 text-gray-600" /> : <HiChevronUp className="w-3 h-3 text-gray-600" />}
          </button>
          {!isCollapsed && (
            <div className="px-3 pb-3 text-xs">
              <MarkdownRenderer content={summary} />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={generateSummary}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-[11px] text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition-colors"
          >
            <HiSparkles className="w-3.5 h-3.5" />
            {isLoading ? 'Generating...' : `Summarize ${STAGE_LABELS[stage] || stage} stage`}
          </button>
          {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
      )}
    </div>
  )
}

export default StageSummaryBanner
