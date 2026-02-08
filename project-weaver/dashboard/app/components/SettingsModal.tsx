'use client'

import React, { useState, useEffect } from 'react'
import { HiX, HiKey, HiCheck, HiExclamation } from 'react-icons/hi'
import { getGeminiKey, setGeminiKey, clearGeminiKey } from '../lib/gemini-key'

interface SettingsModalProps {
  onClose: () => void
  onKeyChange: (hasKey: boolean) => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onKeyChange }) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [error, setError] = useState('')
  const [hasExisting, setHasExisting] = useState(false)

  useEffect(() => {
    const existing = getGeminiKey()
    if (existing) {
      setApiKey(existing)
      setHasExisting(true)
      setStatus('valid')
    }
  }, [])

  const validate = async () => {
    if (!apiKey.trim()) return
    setStatus('validating')
    setError('')

    try {
      const res = await fetch('/api/gemini/key-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()

      if (data.valid) {
        setGeminiKey(apiKey.trim())
        setStatus('valid')
        setHasExisting(true)
        onKeyChange(true)
      } else {
        setStatus('invalid')
        setError(data.error || 'Invalid API key')
      }
    } catch {
      setStatus('invalid')
      setError('Failed to validate key')
    }
  }

  const handleRemove = () => {
    clearGeminiKey()
    setApiKey('')
    setStatus('idle')
    setHasExisting(false)
    onKeyChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HiKey className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Gemini API Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400">
            <HiX className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setStatus('idle'); setError('') }}
                placeholder="AIza..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Status */}
          {status === 'valid' && (
            <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <HiCheck className="w-4 h-4" />
              API key is valid and saved
            </div>
          )}
          {status === 'invalid' && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <HiExclamation className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={validate}
              disabled={!apiKey.trim() || status === 'validating'}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {status === 'validating' ? 'Validating...' : 'Validate & Save'}
            </button>
            {hasExisting && (
              <button
                onClick={handleRemove}
                className="px-4 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {/* Env var notice */}
          <p className="text-[10px] text-gray-600 mt-2">
            Alternatively, set the <code className="text-gray-500">GEMINI_API_KEY</code> environment variable. The API key is stored in your browser&apos;s localStorage and sent to the server via a request header.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
