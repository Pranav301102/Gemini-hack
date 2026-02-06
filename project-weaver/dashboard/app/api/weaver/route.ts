import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

function findWeaverDir(): string | null {
  // Check common locations: CWD, env var, or scan parent directories
  const candidates = [
    process.env.WEAVER_PROJECT_PATH,
    process.cwd(),
    path.resolve(process.cwd(), '..'),
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
  const projectPath = searchParams.get('path')

  let weaverDir: string | null = null

  if (projectPath) {
    const candidate = path.join(projectPath, '.weaver')
    if (fs.existsSync(path.join(candidate, 'context.json'))) {
      weaverDir = candidate
    }
  }

  if (!weaverDir) {
    weaverDir = findWeaverDir()
  }

  if (!weaverDir) {
    return NextResponse.json({
      success: false,
      message: 'No .weaver/ project found. Set WEAVER_PROJECT_PATH env var or pass ?path=/your/project',
    }, { status: 404 })
  }

  try {
    // Read context board
    const contextFile = path.join(weaverDir, 'context.json')
    const contextRaw = fs.readFileSync(contextFile, 'utf-8')
    const context = JSON.parse(contextRaw)

    // Read today's logs
    const logsDir = path.join(weaverDir, 'logs')
    let events: unknown[] = []

    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()

      // Read last 2 days of logs
      const recentFiles = logFiles.slice(-2)
      for (const file of recentFiles) {
        const lines = fs.readFileSync(path.join(logsDir, file), 'utf-8')
          .split('\n')
          .filter(Boolean)
        for (const line of lines) {
          try {
            events.push(JSON.parse(line))
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      context,
      events,
      weaverDir,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Error reading .weaver/ data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 })
  }
}
