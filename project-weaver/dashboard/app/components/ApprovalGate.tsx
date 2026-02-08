'use client'

import React, { useState } from 'react'
import { HiCheckCircle, HiXCircle, HiExclamation, HiDocumentText, HiLightBulb } from 'react-icons/hi'
import MarkdownRenderer from './MarkdownRenderer'
import ApprovalAssistant from './ApprovalAssistant'

interface ContextEntry {
  id: string
  timestamp: string
  agent: string
  stage: string
  type: 'decision' | 'artifact' | 'question' | 'feedback' | 'handoff'
  title: string
  content: string
  metadata?: Record<string, unknown>
}

interface ApprovalGateProps {
  entries: ContextEntry[]
  projectPath: string
  onApprovalComplete: () => void
  geminiReady?: boolean
}

const ApprovalGate: React.FC<ApprovalGateProps> = ({ entries, projectPath, onApprovalComplete, geminiReady }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showChangesForm, setShowChangesForm] = useState(false)
  const [comments, setComments] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['architecture', 'spec', 'stories', 'styleGuide']))

  // Gather relevant entries for review
  const architectureEntries = entries.filter(
    e => e.stage === 'architecture' && (e.type === 'artifact' || e.type === 'decision')
  )
  const specEntries = entries.filter(
    e => e.stage === 'spec' && e.type === 'artifact'
  )
  const storyEntries = entries.filter(
    e => e.stage === 'stories' && e.type === 'artifact'
  )
  const styleGuideEntries = entries.filter(
    e => e.type === 'decision' && e.metadata?.isStyleGuide === true
  )

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/weaver/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', projectPath }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) {
        setTimeout(onApprovalComplete, 1500)
      }
    } catch (err) {
      setResult({ success: false, message: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!comments.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/weaver/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'changes-requested',
          comments,
          projectPath,
        }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) {
        setTimeout(onApprovalComplete, 1500)
      }
    } catch (err) {
      setResult({ success: false, message: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderSection = (
    key: string,
    title: string,
    icon: React.ElementType,
    iconColor: string,
    sectionEntries: ContextEntry[],
  ) => {
    const Icon = icon
    const isExpanded = expandedSections.has(key)

    if (sectionEntries.length === 0) return null

    return (
      <div key={key} className="border border-gray-800 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-medium text-gray-200 flex-1 text-left">{title}</span>
          <span className="text-[10px] text-gray-500">{sectionEntries.length} {sectionEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-gray-500 text-xs">{isExpanded ? '▾' : '▸'}</span>
        </button>
        {isExpanded && (
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {sectionEntries.map(entry => (
              <div key={entry.id} className="border-l-2 border-gray-700 pl-3">
                <h4 className="text-xs font-medium text-gray-300 mb-2">{entry.title}</h4>
                <div className="text-xs">
                  <MarkdownRenderer content={entry.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <HiExclamation className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Approval Required</h2>
            <p className="text-sm text-gray-400 mt-1">
              Review the architecture, specification, and user stories below. Approve to proceed to implementation, or request changes to refine the design.
            </p>
          </div>
        </div>
      </div>

      {/* Review sections */}
      <div className="space-y-3 mb-6">
        {renderSection('architecture', 'Architecture & Design Decisions', HiDocumentText, 'text-blue-400', architectureEntries)}
        {renderSection('styleGuide', 'Coding Style Guide', HiLightBulb, 'text-yellow-400', styleGuideEntries)}
        {renderSection('spec', 'Product Specification', HiDocumentText, 'text-purple-400', specEntries)}
        {renderSection('stories', 'User Stories', HiDocumentText, 'text-green-400', storyEntries)}
      </div>

      {/* AI Approval Assistant */}
      {geminiReady && (
        <div className="mb-6">
          <ApprovalAssistant projectPath={projectPath} geminiReady={geminiReady} />
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div className={`mb-4 p-4 rounded-lg border ${
          result.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <p className="text-sm">{result.message}</p>
        </div>
      )}

      {/* Action buttons */}
      {!result?.success && (
        <div className="space-y-4">
          {showChangesForm ? (
            <div className="border border-orange-500/30 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-orange-400">Request Changes</h3>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Describe what needs to change..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-none h-24"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRequestChanges}
                  disabled={isSubmitting || !comments.trim()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Changes Request'}
                </button>
                <button
                  onClick={() => setShowChangesForm(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-green-500/20"
              >
                <HiCheckCircle className="w-5 h-5" />
                {isSubmitting ? 'Approving...' : 'Approve & Continue'}
              </button>
              <button
                onClick={() => setShowChangesForm(true)}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600/20 border border-orange-500/30 hover:bg-orange-600/30 text-orange-400 text-sm font-medium rounded-lg transition-colors"
              >
                <HiXCircle className="w-5 h-5" />
                Request Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ApprovalGate
