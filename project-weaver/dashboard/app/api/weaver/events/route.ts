import { NextRequest } from 'next/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

function findWeaverDir(projectPath?: string): string | null {
  const candidates = [
    projectPath,
    process.env.WEAVER_PROJECT_PATH,
    process.cwd(),
  ].filter(Boolean) as string[]

  for (const dir of candidates) {
    const weaverPath = path.join(dir, '.weaver', 'context.json')
    if (fs.existsSync(weaverPath)) {
      return path.join(dir, '.weaver')
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectPath = searchParams.get('path') ?? undefined
  const weaverDir = findWeaverDir(projectPath)

  if (!weaverDir) {
    return new Response('No .weaver/ project found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let lastEventCount = 0
      let lastContextModified = 0
      let lastDocsModified = 0

      const sendEvent = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const checkForUpdates = () => {
        try {
          // Check context board for changes
          const contextFile = path.join(weaverDir, 'context.json')
          if (fs.existsSync(contextFile)) {
            const stat = fs.statSync(contextFile)
            const mtime = stat.mtimeMs
            if (mtime > lastContextModified) {
              lastContextModified = mtime
              const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'))
              // Migrate old pipeline format
              if (context.pipeline && !context.phase) {
                const cs = context.pipeline.currentStage
                context.phase = cs === 'read' ? 'read' : ['architecture','spec','stories','approval'].includes(cs) ? 'plan' : 'ready'
                if (Array.isArray(context.entries)) {
                  const stageMap: Record<string, string> = { read:'read', architecture:'plan', spec:'plan', stories:'plan', approval:'plan', implementation:'ready', testing:'ready', review:'ready', ship:'ready' }
                  const typeMap: Record<string, string> = { handoff:'decision', feedback:'proposal' }
                  for (const e of context.entries) {
                    if (e.stage && !e.phase) e.phase = stageMap[e.stage] ?? 'plan'
                    if (typeMap[e.type]) e.type = typeMap[e.type]
                  }
                }
              }
              sendEvent('context', context)
            }
          }

          // Check docs.json for changes
          const docsFile = path.join(weaverDir, 'docs.json')
          if (fs.existsSync(docsFile)) {
            const docsStat = fs.statSync(docsFile)
            if (docsStat.mtimeMs > lastDocsModified) {
              lastDocsModified = docsStat.mtimeMs
              try {
                const docs = JSON.parse(fs.readFileSync(docsFile, 'utf-8'))
                sendEvent('docs', docs)
              } catch {
                // Skip malformed
              }
            }
          }

          // Check logs for new events
          const logsDir = path.join(weaverDir, 'logs')
          if (fs.existsSync(logsDir)) {
            const dateStr = new Date().toISOString().split('T')[0]
            const logFile = path.join(logsDir, `${dateStr}.jsonl`)

            if (fs.existsSync(logFile)) {
              const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)
              if (lines.length > lastEventCount) {
                const newLines = lines.slice(lastEventCount)
                lastEventCount = lines.length
                for (const line of newLines) {
                  try {
                    const event = JSON.parse(line)
                    sendEvent('log', event)
                  } catch {
                    // Skip malformed
                  }
                }
              }
            }
          }
        } catch {
          // Non-fatal, will retry on next interval
        }
      }

      // Initial data push
      checkForUpdates()

      // Poll every 2 seconds
      const interval = setInterval(checkForUpdates, 2000)

      // Send keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(interval)
          clearInterval(keepalive)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(keepalive)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
