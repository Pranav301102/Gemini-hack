import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

function findWeaverDir(projectPath?: string | null): string | null {
  const candidates = [
    projectPath,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, comments, requestedChanges, projectPath } = body as {
      status: 'approved' | 'changes-requested'
      comments?: string
      requestedChanges?: string[]
      projectPath?: string
    }

    if (!status || !['approved', 'changes-requested'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Invalid status. Must be "approved" or "changes-requested".' }, { status: 400 })
    }

    const weaverDir = findWeaverDir(projectPath)
    if (!weaverDir) {
      return NextResponse.json({ success: false, message: 'No .weaver/ project found.' }, { status: 404 })
    }

    const contextFile = path.join(weaverDir, 'context.json')
    const contextRaw = fs.readFileSync(contextFile, 'utf-8')
    const context = JSON.parse(contextRaw)

    // Set approval state
    context.approval = {
      status,
      reviewedAt: new Date().toISOString(),
      comments: comments ?? undefined,
      requestedChanges: requestedChanges ?? undefined,
    }

    if (status === 'approved') {
      // Advance approval stage to complete
      if (context.pipeline?.stages?.approval) {
        context.pipeline.stages.approval.status = 'complete'
        context.pipeline.stages.approval.completedAt = new Date().toISOString()
        context.pipeline.stages.approval.assignedAgent = 'user'
      }
      // Advance current stage to implementation
      context.pipeline.currentStage = 'implementation'
    } else {
      // Changes requested — reset to architecture
      const stagesToReset = ['architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship']
      for (const stage of stagesToReset) {
        if (context.pipeline?.stages?.[stage]) {
          context.pipeline.stages[stage].status = 'pending'
          context.pipeline.stages[stage].startedAt = undefined
          context.pipeline.stages[stage].completedAt = undefined
          context.pipeline.stages[stage].assignedAgent = undefined
        }
      }
      context.pipeline.currentStage = 'architecture'
    }

    context.updatedAt = new Date().toISOString()

    // Write back
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8')

    // Log the event
    const logsDir = path.join(weaverDir, 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.jsonl`)
    const logEntry = JSON.stringify({
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      stage: 'approval',
      action: status === 'approved' ? 'approval_granted' : 'changes_requested',
      message: status === 'approved'
        ? 'User approved. Pipeline proceeding to implementation.'
        : `User requested changes: ${comments ?? 'No comments'}`,
    })
    fs.appendFileSync(logFile, logEntry + '\n')

    return NextResponse.json({
      success: true,
      message: status === 'approved'
        ? 'Approved! Pipeline will proceed to implementation.'
        : 'Changes requested. Pipeline reset to architecture stage.',
      status,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 })
  }
}
