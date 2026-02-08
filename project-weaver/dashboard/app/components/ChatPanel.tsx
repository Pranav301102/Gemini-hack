'use client'

import React, { useState, useRef, useEffect } from 'react'
import { HiX, HiChat, HiPaperAirplane, HiTrash } from 'react-icons/hi'
import { getGeminiHeaders } from '../lib/gemini-key'
import MarkdownRenderer from './MarkdownRenderer'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  projectPath: string
  isOpen: boolean
  onClose: () => void
}

const ChatPanel: React.FC<ChatPanelProps> = ({ projectPath, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getGeminiHeaders() },
        body: JSON.stringify({ messages: newMessages, projectPath }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err.error || 'Request failed'}` }
          return copy
        })
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      let accumulated = ''
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                accumulated += `\n\nError: ${parsed.error}`
              } else if (parsed.text) {
                accumulated += parsed.text
              }
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: accumulated }
                return copy
              })
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }
        return copy
      })
    }

    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-0 right-0 w-[420px] h-[600px] z-40 flex flex-col bg-gray-900 border border-gray-700 rounded-tl-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <HiChat className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Chat with Codebase</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-500 hover:text-gray-300"
              title="Clear chat"
            >
              <HiTrash className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-400">
            <HiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-xs mt-8">
            <HiChat className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Ask anything about your codebase</p>
            <p className="text-gray-700 mt-1">Uses the enriched code index as context</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your codebase..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <HiPaperAirplane className="w-4 h-4 text-white rotate-90" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
