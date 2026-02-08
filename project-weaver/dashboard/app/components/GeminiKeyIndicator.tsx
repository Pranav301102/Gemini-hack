'use client'

import React from 'react'

interface GeminiKeyIndicatorProps {
  hasKey: boolean
  onClick: () => void
}

const GeminiKeyIndicator: React.FC<GeminiKeyIndicatorProps> = ({ hasKey, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors text-xs"
      title={hasKey ? 'Gemini API configured' : 'Click to set Gemini API key'}
    >
      <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-gray-600'}`} />
      <span className={hasKey ? 'text-green-400' : 'text-gray-500'}>
        {hasKey ? 'AI Ready' : 'No API Key'}
      </span>
    </button>
  )
}

export default GeminiKeyIndicator
