'use client'

import React, { useState, useRef } from 'react'
import { HiX, HiSparkles, HiStop, HiCheck } from 'react-icons/hi'
import { getGeminiHeaders } from '../lib/gemini-key'

interface EnrichmentPanelProps {
  projectPath: string
  initialProgress?: { totalItems: number; enrichedItems: number }
  onClose: () => void
}

const EnrichmentPanel: React.FC<EnrichmentPanelProps> = ({ projectPath, initialProgress, onClose }) => {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(initialProgress ?? { totalItems: 0, enrichedItems: 0 })
  const [batchSize, setBatchSize] = useState(15)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  const remaining = progress.totalItems - progress.enrichedItems
  const pct = progress.totalItems > 0 ? Math.round((progress.enrichedItems / progress.totalItems) * 100) : 0

  const runEnrichment = async () => {
    setIsRunning(true)
    stopRef.current = false
    setError(null)
    setLogs([])

    let batchNum = 0
    while (!stopRef.current) {
      batchNum++
      setLogs(prev => [...prev, `Batch ${batchNum}: Enriching ${batchSize} items...`])

      try {
        const res = await fetch('/api/gemini/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getGeminiHeaders() },
          body: JSON.stringify({ projectPath, batchSize }),
        })
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'Enrichment failed')
          break
        }

        const prog = data.progress
        if (prog && typeof prog.total === 'number' && typeof prog.enriched === 'number') {
          setProgress({ totalItems: prog.total, enrichedItems: prog.enriched })
        }

        if (data.enriched && Array.isArray(data.enriched)) {
          for (const item of data.enriched) {
            setLogs(prev => [...prev, `  ${item}`])
          }
        }

        const updated = data.updated ?? 0
        setLogs(prev => [...prev, `Batch ${batchNum}: +${updated} items (${prog?.enriched ?? '?'}/${prog?.total ?? '?'})`])

        if (prog?.remaining === 0 || updated === 0) {
          setLogs(prev => [...prev, updated === 0 ? 'No more items to enrich.' : 'Enrichment complete!'])
          break
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
        break
      }
    }

    setIsRunning(false)
  }

  const stop = () => {
    stopRef.current = true
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiSparkles className="w-5 h-5 text-yellow-400" />
            <h2 className="text-base font-bold text-white">Auto-Enrich Codebase</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400">
            <HiX className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Enrichment Progress</span>
            <span className="text-xs font-mono text-gray-300">{progress.enrichedItems}/{progress.totalItems} ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-yellow-500 to-green-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {remaining > 0 && !isRunning && (
            <p className="text-[10px] text-gray-500 mt-1">{remaining} items need enrichment</p>
          )}
        </div>

        {/* Batch size selector */}
        {!isRunning && remaining > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-400">Batch size:</span>
            {[10, 15, 25].map(size => (
              <button
                key={size}
                onClick={() => setBatchSize(size)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  batchSize === size ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {/* Log output */}
        {logs.length > 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto font-mono text-[11px] text-gray-400 space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className={log.startsWith('  ') ? 'text-gray-500 pl-2' : ''}>{log}</div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isRunning && remaining > 0 && (
            <button
              onClick={runEnrichment}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiSparkles className="w-4 h-4" />
              Start Enrichment
            </button>
          )}
          {isRunning && (
            <button
              onClick={stop}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiStop className="w-4 h-4" />
              Stop
            </button>
          )}
          {remaining === 0 && progress.totalItems > 0 && (
            <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium rounded-lg">
              <HiCheck className="w-4 h-4" />
              All items enriched!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnrichmentPanel
