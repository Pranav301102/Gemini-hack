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

    // Read enrichment progress from index.json if available
    let enrichmentProgress = null
    const indexFile = path.join(weaverDir, 'index.json')
    if (fs.existsSync(indexFile)) {
      try {
        const indexRaw = fs.readFileSync(indexFile, 'utf-8')
        const index = JSON.parse(indexRaw)
        if (index.enrichmentProgress) {
          enrichmentProgress = index.enrichmentProgress
        }
      } catch {
        // Skip if index.json is malformed
      }
    }

    // Read standalone plan.json if available and not already in context
    let plan = context.plan ?? null
    const planFile = path.join(weaverDir, 'plan.json')
    if (!plan && fs.existsSync(planFile)) {
      try {
        const planRaw = fs.readFileSync(planFile, 'utf-8')
        plan = JSON.parse(planRaw)
      } catch {
        // Skip if plan.json is malformed
      }
    }

    // Read code maps if available
    let codeMaps = null
    const codeMapsFile = path.join(weaverDir, 'code-maps.json')
    if (fs.existsSync(codeMapsFile)) {
      try {
        codeMaps = JSON.parse(fs.readFileSync(codeMapsFile, 'utf-8'))
      } catch {
        // Skip if code-maps.json is malformed
      }
    }

    // Read docs.json if available
    let docs = null
    const docsFile = path.join(weaverDir, 'docs.json')
    if (fs.existsSync(docsFile)) {
      try {
        docs = JSON.parse(fs.readFileSync(docsFile, 'utf-8'))
      } catch {
        // Skip if docs.json is malformed
      }
    }

    // Migration: if old pipeline format, convert for dashboard
    if (context.pipeline && !context.phase) {
      const currentStage = context.pipeline.currentStage
      if (currentStage === 'read') {
        context.phase = 'read'
      } else if (['architecture', 'spec', 'stories', 'approval'].includes(currentStage)) {
        context.phase = 'plan'
      } else {
        context.phase = 'ready'
      }
      // Migrate entries: stage → phase, old types → new types
      if (Array.isArray(context.entries)) {
        const STAGE_TO_PHASE: Record<string, string> = {
          read: 'read', architecture: 'plan', spec: 'plan',
          stories: 'plan', approval: 'plan', implementation: 'ready',
          testing: 'ready', review: 'ready', ship: 'ready',
        }
        const TYPE_MIGRATION: Record<string, string> = {
          handoff: 'decision', feedback: 'proposal',
        }
        for (const entry of context.entries) {
          if (entry.stage && !entry.phase) {
            entry.phase = STAGE_TO_PHASE[entry.stage] ?? 'plan'
          }
          if (TYPE_MIGRATION[entry.type]) {
            entry.type = TYPE_MIGRATION[entry.type]
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      context,
      events,
      weaverDir,
      enrichmentProgress,
      plan,
      codeMaps,
      docs,
      approval: context.approval ?? null,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Error reading .weaver/ data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 })
  }
}
