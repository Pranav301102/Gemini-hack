'use client'

import React, { useState, useMemo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import {
  HiCode,
  HiCube,
  HiCog,
  HiLightBulb,
  HiDocumentText,
  HiBookOpen,
  HiClipboardList,
  HiSearch,
  HiArrowLeft,
} from 'react-icons/hi'

interface DocEntry {
  id: string
  category: string
  title: string
  content: string
  agent: string
  tags: string[]
  createdAt: string
  updatedAt: string
  revisions: { timestamp: string; agent: string }[]
}

export interface DocsCollection {
  version: string
  docs: DocEntry[]
}

interface DocsBrowserProps {
  docs: DocsCollection | null
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  api: { label: 'API', icon: HiCode, color: 'text-green-400' },
  architecture: { label: 'Architecture', icon: HiCube, color: 'text-blue-400' },
  setup: { label: 'Setup', icon: HiCog, color: 'text-gray-400' },
  feature: { label: 'Features', icon: HiLightBulb, color: 'text-yellow-400' },
  decision: { label: 'Decisions', icon: HiDocumentText, color: 'text-purple-400' },
  runbook: { label: 'Runbooks', icon: HiBookOpen, color: 'text-orange-400' },
  changelog: { label: 'Changelog', icon: HiClipboardList, color: 'text-cyan-400' },
}

const AGENT_COLORS: Record<string, string> = {
  'product-manager': 'bg-purple-900/30 text-purple-400 border-purple-800',
  'architect': 'bg-blue-900/30 text-blue-400 border-blue-800',
  'developer': 'bg-green-900/30 text-green-400 border-green-800',
  'qa': 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  'code-reviewer': 'bg-red-900/30 text-red-400 border-red-800',
}

const AGENT_LABELS: Record<string, string> = {
  'product-manager': 'PM',
  'architect': 'Arch',
  'developer': 'Dev',
  'qa': 'QA',
  'code-reviewer': 'CR',
}

export default function DocsBrowser({ docs }: DocsBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cat of Object.keys(CATEGORY_CONFIG)) {
      counts[cat] = 0
    }
    if (docs?.docs) {
      for (const doc of docs.docs) {
        counts[doc.category] = (counts[doc.category] || 0) + 1
      }
    }
    return counts
  }, [docs])

  const filteredDocs = useMemo(() => {
    if (!docs?.docs) return []
    let result = docs.docs
    if (selectedCategory) result = result.filter(d => d.category === selectedCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [docs, selectedCategory, searchQuery])

  const selectedDoc = useMemo(() => {
    if (!selectedDocId || !docs?.docs) return null
    return docs.docs.find(d => d.id === selectedDocId) ?? null
  }, [selectedDocId, docs])

  if (!docs || docs.docs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <HiDocumentText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documentation yet</p>
          <p className="text-xs mt-1">Run /docs to generate project documentation</p>
        </div>
      </div>
    )
  }

  // Detail view for a single doc
  if (selectedDoc) {
    const catConfig = CATEGORY_CONFIG[selectedDoc.category]
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
          <button
            onClick={() => setSelectedDocId(null)}
            className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
          >
            <HiArrowLeft className="w-4 h-4" />
          </button>
          {catConfig && (
            <span className={`text-xs px-2 py-0.5 rounded border ${
              selectedDoc.category === 'api' ? 'bg-green-900/20 text-green-400 border-green-800' :
              selectedDoc.category === 'architecture' ? 'bg-blue-900/20 text-blue-400 border-blue-800' :
              selectedDoc.category === 'setup' ? 'bg-gray-800 text-gray-400 border-gray-700' :
              selectedDoc.category === 'feature' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-800' :
              selectedDoc.category === 'decision' ? 'bg-purple-900/20 text-purple-400 border-purple-800' :
              selectedDoc.category === 'runbook' ? 'bg-orange-900/20 text-orange-400 border-orange-800' :
              'bg-cyan-900/20 text-cyan-400 border-cyan-800'
            }`}>
              {catConfig.label}
            </span>
          )}
          <h2 className="text-sm font-medium text-white flex-1">{selectedDoc.title}</h2>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${AGENT_COLORS[selectedDoc.agent] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {AGENT_LABELS[selectedDoc.agent] ?? selectedDoc.agent}
          </span>
          {selectedDoc.revisions.length > 0 && (
            <span className="text-[10px] text-gray-600">
              v{selectedDoc.revisions.length + 1}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            {selectedDoc.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                {tag}
              </span>
            ))}
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownRenderer content={selectedDoc.content} />
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800 text-[10px] text-gray-600 flex gap-4">
            <span>Created: {new Date(selectedDoc.createdAt).toLocaleString()}</span>
            <span>Updated: {new Date(selectedDoc.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="h-full flex">
      {/* Category sidebar */}
      <div className="w-44 flex-shrink-0 border-r border-gray-800 py-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
            !selectedCategory ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
          }`}
        >
          <HiDocumentText className="w-3.5 h-3.5" />
          <span className="flex-1">All Docs</span>
          <span className="text-[10px] text-gray-600">{docs.docs.length}</span>
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const count = categoryCounts[key] || 0
          const Icon = config.icon
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                selectedCategory === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${count > 0 ? config.color : ''}`} />
              <span className="flex-1">{config.label}</span>
              {count > 0 && (
                <span className="text-[10px] text-gray-600">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Doc list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-800">
          <div className="relative">
            <HiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full bg-gray-900 border border-gray-800 rounded pl-7 pr-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>

        {/* Doc cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredDocs.length === 0 ? (
            <div className="text-center text-gray-600 text-xs py-8">
              {searchQuery ? 'No docs match your search' : 'No docs in this category'}
            </div>
          ) : (
            filteredDocs.map(doc => {
              const catConfig = CATEGORY_CONFIG[doc.category]
              const Icon = catConfig?.icon ?? HiDocumentText
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="w-full text-left p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${catConfig?.color ?? 'text-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-medium text-white truncate">{doc.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${AGENT_COLORS[doc.agent] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                          {AGENT_LABELS[doc.agent] ?? doc.agent}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                        {doc.content.substring(0, 150).replace(/[#*`]/g, '')}
                        {doc.content.length > 150 ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {doc.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
                            {tag}
                          </span>
                        ))}
                        {doc.tags.length > 3 && (
                          <span className="text-[10px] text-gray-600">+{doc.tags.length - 3}</span>
                        )}
                        <span className="text-[10px] text-gray-700 ml-auto">
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
