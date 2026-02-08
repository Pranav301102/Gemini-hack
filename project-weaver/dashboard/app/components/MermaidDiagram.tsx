'use client'

import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  chart: string
  className?: string
}

/**
 * Full Mermaid syntax cleanup ported from project-weaver-main.
 * Fixes common AI-generated syntax issues that break Mermaid parsing.
 */
function cleanMermaidSyntax(raw: string): string {
  let chart = raw.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Auto-detect diagram type if missing
  if (!chart.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitgraph|mindmap|timeline|sankey|xychart|quadrantChart|requirement|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i)) {
    if (/participant\s+|actor\s+|\->>|\-\->>/.test(chart)) {
      chart = `sequenceDiagram\n${chart}`
    } else if (/-->|->|--/.test(chart)) {
      chart = `flowchart TD\n${chart}`
    }
  }

  // Remove trailing semicolons
  chart = chart.replace(/;\s*$/gm, '')

  // Fix parentheses inside square brackets: [text(stuff)] -> ["text(stuff)"]
  // Skip already-quoted content (starts with ")
  chart = chart.replace(/\[([^\["]*)\(([^)]*)\)([^\]]*)\]/g, '["$1($2)$3"]')

  // Fix parentheses inside curly braces: {text(stuff)} -> {"text(stuff)"}
  // Skip already-quoted content (starts with ")
  chart = chart.replace(/\{([^{"]*)\(([^)]*)\)([^}]*)\}/g, '{"$1($2)$3"}')

  // Fix spaces in node IDs by wrapping labels in quotes
  // e.g., A[My Long Label] -> A["My Long Label"]
  chart = chart.replace(/\[([^\]"]+)\]/g, (match, content) => {
    if (content.includes(' ') && !content.startsWith('"')) {
      return `["${content}"]`
    }
    return match
  })

  // Fix problematic characters in flowchart node labels
  chart = chart.replace(/\[(.*?[<>&].*?)\]/g, (match, content) => {
    if (!content.startsWith('"')) {
      return `["${content.replace(/"/g, "'")}"]`
    }
    return match
  })

  // Fix subgraph syntax: ensure proper indentation and `end` keyword
  chart = chart.replace(/subgraph\s+([^\n]+)\n/g, (match, title) => {
    const cleanTitle = title.trim()
    if (!cleanTitle.startsWith('"') && cleanTitle.includes(' ')) {
      return `subgraph "${cleanTitle}"\n`
    }
    return match
  })

  // Fix Gantt diagram section:colon splitting
  if (chart.match(/^gantt/im)) {
    chart = chart.replace(/^(\s*section\s+.+):(.+)/gm, '$1\n$2')
    // Remove trailing colons in Gantt
    chart = chart.replace(/:\s*$/gm, '')
  }

  // Remove empty lines that sometimes break parsing
  chart = chart.replace(/\n{3,}/g, '\n\n')

  return chart
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const elementRef = useRef<HTMLDivElement>(null)
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeMermaid = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1e293b',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#ffffff',
            lineColor: '#ffffff',
            sectionBkgColor: 'transparent',
            altSectionBkgColor: 'transparent',
            gridColor: '#ffffff',
            secondaryColor: '#0f172a',
            tertiaryColor: '#334155',
            background: 'transparent',
            mainBkg: 'transparent',
            secondBkg: 'transparent',
            tertiaryBkg: 'transparent',
          },
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          suppressErrorRendering: true,
          logLevel: 'error',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'linear' },
          sequence: { useMaxWidth: true, mirrorActors: true },
          gantt: { useMaxWidth: true },
        })
        setIsInitialized(true)
      } catch {
        setIsInitialized(true)
      }
    }
    initializeMermaid()
  }, [])

  useEffect(() => {
    const renderDiagram = async () => {
      if (!isInitialized || !elementRef.current || !chart.trim()) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setIsError(false)

      const timeoutId = setTimeout(() => {
        setIsError(true)
        setIsLoading(false)
        if (elementRef.current) {
          elementRef.current.innerHTML = `<pre class="bg-gray-800 p-3 rounded text-xs overflow-auto font-mono text-gray-200">${chart}</pre>`
        }
      }, 10000)

      try {
        const cleanChart = cleanMermaidSyntax(chart)
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

        const originalConsoleError = console.error
        const originalConsoleWarn = console.warn
        console.error = () => {}
        console.warn = () => {}

        try {
          const renderResult = await mermaid.render(id, cleanChart)
          clearTimeout(timeoutId)

          if (elementRef.current && renderResult?.svg) {
            elementRef.current.innerHTML = renderResult.svg
            const svg = elementRef.current.querySelector('svg')
            if (svg) {
              svg.style.maxWidth = '100%'
              svg.style.height = 'auto'
              svg.style.background = 'transparent'
            }
          } else {
            throw new Error('No SVG returned')
          }
        } finally {
          console.error = originalConsoleError
          console.warn = originalConsoleWarn
        }
      } catch {
        clearTimeout(timeoutId)
        setIsError(true)
        if (elementRef.current) {
          elementRef.current.innerHTML = `<pre class="bg-gray-800 p-3 rounded text-xs overflow-auto font-mono text-gray-200">${chart}</pre>`
        }
      } finally {
        setIsLoading(false)
      }
    }

    renderDiagram()
  }, [chart, isInitialized])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 bg-gray-800 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-xs">Rendering diagram...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-transparent rounded-lg p-4 border border-gray-700 ${className}`}>
      {isError && (
        <div className="mb-2 text-yellow-400 text-xs">Diagram rendered as code (syntax issue)</div>
      )}
      <div
        ref={elementRef}
        className="mermaid-diagram flex justify-center items-center min-h-[100px] overflow-auto"
        style={{ maxWidth: '100%', fontSize: '12px', background: 'transparent' }}
      />
    </div>
  )
}

export default MermaidDiagram
