'use client'

import React, { useState, useEffect } from 'react'
import { HiX, HiSparkles } from 'react-icons/hi'
import { getGeminiHeaders } from '../lib/gemini-key'
import MarkdownRenderer from './MarkdownRenderer'

interface CodeExplainPopoverProps {
  filePath: string
  projectPath: string
  onClose: () => void
}

const CodeExplainPopover: React.FC<CodeExplainPopoverProps> = ({ filePath, projectPath, onClose }) => {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExplanation = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getGeminiHeaders() },
        body: JSON.stringify({ projectPath, filePath }),
      })
      const data = await res.json()
      if (data.explanation) {
        setExplanation(data.explanation)
      } else {
        setError(data.error || 'No explanation generated')
      }
    } catch {
      setError('Failed to get explanation')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchExplanation()
  }, [filePath, projectPath]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 shadow-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <HiSparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-xs font-mono text-gray-300 truncate">{filePath}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 flex-shrink-0">
            <HiX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto text-xs">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-gray-600 border-t-yellow-400 rounded-full mr-2" />
              Analyzing...
            </div>
          )}
          {error && (
            <div className="space-y-2">
              <p className="text-red-400">{error}</p>
              <button onClick={fetchExplanation} className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors">
                Retry
              </button>
            </div>
          )}
          {explanation && <MarkdownRenderer content={explanation} />}
        </div>
      </div>
    </div>
  )
}

export default CodeExplainPopover
