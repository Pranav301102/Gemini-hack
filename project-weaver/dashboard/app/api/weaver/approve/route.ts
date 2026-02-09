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
    const { status, comments, projectPath } = body as {
      status: 'approved' | 'changes-requested'
      comments?: string
      projectPath?: string
    }

    if (!status || !['approved', 'changes-requested'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status. Must be "approved" or "changes-requested".' },
        { status: 400 }
      )
    }

    const weaverDir = findWeaverDir(projectPath)
    if (!weaverDir) {
      return NextResponse.json(
        { success: false, message: 'No .weaver/ project found.' },
        { status: 404 }
      )
    }

    const contextFile = path.join(weaverDir, 'context.json')
    const raw = fs.readFileSync(contextFile, 'utf-8')
    const context = JSON.parse(raw)

    // Read current revision count
    const currentRevisions = context.approval?.revisionCount ?? 0

    // Update approval state
    context.approval = {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'user',
      comments: comments || undefined,
      revisionCount: status === 'changes-requested' ? currentRevisions + 1 : currentRevisions,
    }

    // If approved, transition phase to ready
    if (status === 'approved') {
      context.phase = 'ready'
    }

    // Add a context entry for the approval decision
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      agent: 'product-manager',
      phase: context.phase,
      type: 'decision',
      title: status === 'approved'
        ? '✅ Plan Approved — Ready for Implementation'
        : '🔄 Changes Requested — Revise the Plan',
      content: status === 'approved'
        ? 'The user has reviewed and approved the plan. Proceed with implementation.'
        : `The user has requested changes to the plan.\n\n**Feedback:**\n${comments || 'No specific comments provided.'}`,
      metadata: {
        isApproval: true,
        approvalStatus: status,
      },
    }
    context.entries.push(entry)

    // Write updated context
    context.updatedAt = new Date().toISOString()
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8')

    // Log the event
    const logsDir = path.join(weaverDir, 'logs')
    if (fs.existsSync(logsDir)) {
      const dateStr = new Date().toISOString().split('T')[0]
      const logFile = path.join(logsDir, `${dateStr}.jsonl`)
      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: 'info',
        action: status === 'approved' ? 'plan_approved' : 'changes_requested',
        message: status === 'approved'
          ? 'User approved the plan'
          : `User requested changes: ${comments || 'no comments'}`,
      }
      fs.appendFileSync(logFile, JSON.stringify(event) + '\n', 'utf-8')
    }

    return NextResponse.json({
      success: true,
      message: status === 'approved'
        ? 'Plan approved! Ready for implementation. Use /implement to start building.'
        : 'Changes requested. The plan will be revised.',
      status,
      phase: context.phase,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
