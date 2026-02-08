'use client'

import React, { useState } from 'react'
import { HiSparkles, HiExclamation, HiLightBulb, HiShieldCheck } from 'react-icons/hi'
import { getGeminiHeaders } from '../lib/gemini-key'
import type { ApprovalReview } from '../lib/types'

interface ApprovalAssistantProps {
  projectPath: string
  geminiReady: boolean
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

const SCORE_COLORS: Record<string, string> = {
  high: 'text-green-400 bg-green-500/20 border-green-500/30',
  medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  low: 'text-red-400 bg-red-500/20 border-red-500/30',
}

function getScoreLevel(score: number): string {
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

const ApprovalAssistant: React.FC<ApprovalAssistantProps> = ({ projectPath, geminiReady }) => {
  const [review, setReview] = useState<ApprovalReview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getReview = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gemini/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getGeminiHeaders() },
        body: JSON.stringify({ projectPath }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setReview(data)
      }
    } catch {
      setError('Failed to get AI review')
    }
    setIsLoading(false)
  }

  if (!geminiReady) return null

  if (!review) {
    return (
      <div className="border border-purple-500/20 rounded-lg bg-purple-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <HiSparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-purple-300">AI Approval Assistant</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Get an AI review of your architecture, spec, and stories before approving</p>
          </div>
          <button
            onClick={getReview}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Analyzing...' : 'Get AI Review'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    )
  }

  const scoreLevel = getScoreLevel(review.readinessScore)

  return (
    <div className="border border-purple-500/20 rounded-lg bg-purple-500/5 p-4 space-y-4">
      {/* Header with score */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-bold text-lg ${SCORE_COLORS[scoreLevel]}`}>
          {review.readinessScore}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-purple-300">AI Review</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{review.overallAssessment}</p>
        </div>
      </div>

      {/* Issues */}
      {review.issues.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
            <HiExclamation className="w-3.5 h-3.5 text-red-400" /> Issues ({review.issues.length})
          </h4>
          <div className="space-y-1.5">
            {review.issues.map((issue, i) => (
              <div key={i} className={`px-3 py-2 rounded border text-xs ${SEVERITY_COLORS[issue.severity]}`}>
                <span className="font-medium">{issue.title}</span>
                <span className="text-[10px] ml-2 opacity-70">[{issue.severity}]</span>
                <p className="mt-0.5 opacity-80">{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps */}
      {review.gaps.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
            <HiShieldCheck className="w-3.5 h-3.5 text-yellow-400" /> Gaps ({review.gaps.length})
          </h4>
          <div className="space-y-1.5">
            {review.gaps.map((gap, i) => (
              <div key={i} className="px-3 py-2 rounded bg-yellow-500/5 border border-yellow-500/15 text-xs">
                <span className="font-medium text-yellow-300">{gap.area}</span>
                <p className="text-gray-400 mt-0.5">{gap.description}</p>
                <p className="text-yellow-400/80 mt-0.5 text-[10px]">Recommendation: {gap.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {review.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
            <HiLightBulb className="w-3.5 h-3.5 text-blue-400" /> Recommendations
          </h4>
          <div className="space-y-1.5">
            {review.recommendations.map((rec, i) => (
              <div key={i} className="px-3 py-2 rounded bg-blue-500/5 border border-blue-500/15 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-300">{rec.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{rec.category}</span>
                </div>
                <p className="text-gray-400 mt-0.5">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ApprovalAssistant
