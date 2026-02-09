'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MermaidDiagram from './MermaidDiagram'

interface MarkdownRendererProps {
  content: string
}

function processMermaidDiagrams(text: string) {
  const parts: { type: 'markdown' | 'mermaid'; content: string }[] = []
  let lastIndex = 0

  const codeBlockRegex = /```(?:mermaid|diagram)?\s*\n([\s\S]*?)```/g
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const diagramContent = match[1].trim()

    const isMermaidDiagram = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitgraph|mindmap|timeline|sankey|xychart|quadrantChart|requirement|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i.test(diagramContent)
    const hasArrowPatterns = /-->|->|--|\|\||participant\s+|actor\s+|\->>|\-\->>/.test(diagramContent)

    if (isMermaidDiagram || hasArrowPatterns) {
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index)
        if (textBefore.trim()) parts.push({ type: 'markdown', content: textBefore })
      }

      let cleanDiagram = diagramContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      if (!cleanDiagram.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitgraph|mindmap|timeline)\b/i)) {
        if (/participant\s+|actor\s+|\->>|\-\->>/.test(cleanDiagram)) {
          cleanDiagram = `sequenceDiagram\n${cleanDiagram}`
        } else if (/-->|->|--/.test(cleanDiagram)) {
          cleanDiagram = `flowchart TD\n${cleanDiagram}`
        }
      }

      parts.push({ type: 'mermaid', content: cleanDiagram })
      lastIndex = match.index + match[0].length
    }
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) parts.push({ type: 'markdown', content: remaining })
  }

  if (parts.length === 0) parts.push({ type: 'markdown', content: text })

  return parts
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content || typeof content !== 'string') {
    return <p className="text-xs text-gray-500">No content available</p>
  }

  const contentParts = processMermaidDiagrams(content)

  return (
    <div className="markdown-content prose prose-sm prose-invert max-w-none">
      {contentParts.map((part, index) => {
        if (part.type === 'mermaid') {
          return (
            <div key={index} className="my-4">
              <MermaidDiagram chart={part.content} />
            </div>
          )
        }
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-lg font-bold mb-4 mt-6 text-gray-100 border-b border-gray-700 pb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold mb-3 mt-5 text-gray-200">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-medium mb-2 mt-4 text-gray-300">{children}</h3>,
              p: ({ children }) => <p className="text-xs leading-relaxed mb-3 text-gray-300">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-4 ml-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-4 ml-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-xs leading-relaxed text-gray-300">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-600 pl-4 mb-4 italic text-gray-400">{children}</blockquote>,
              code: ({ children }) => <code className="bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
              pre: ({ children }) => <div className="mb-4"><pre className="bg-gray-800 p-3 rounded-lg text-xs overflow-x-auto border border-gray-700">{children}</pre></div>,
              table: ({ children }) => (
                <div className="mb-4 overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-gray-800 border-b border-gray-700">{children}</thead>,
              tbody: ({ children }) => <tbody className="divide-y divide-gray-800">{children}</tbody>,
              tr: ({ children }) => <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>,
              th: ({ children }) => <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-300 uppercase tracking-wider">{children}</th>,
              td: ({ children }) => <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{children}</td>,
            }}
          >
            {part.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}

export default MarkdownRenderer
