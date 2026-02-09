import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import * as crypto from 'node:crypto'

const DEFAULT_HUB_URL = process.env.WEAVER_HUB_URL ?? 'http://localhost:4200'

function getGitInfo(projectPath: string): { remote: string | null; branch: string; user: string } {
  let remote: string | null = null
  let branch = 'main'
  let user = 'Unknown'

  try { remote = execSync('git config --get remote.origin.url', { cwd: projectPath, encoding: 'utf-8' }).trim() } catch {}
  try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim() } catch {}
  try { user = execSync('git config user.name', { cwd: projectPath, encoding: 'utf-8' }).trim() } catch {}

  return { remote, branch, user }
}

function repoHash(url: string): string {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex').slice(0, 16)
}

const SYNC_FILES = [
  'context.json', 'index.json', 'plan.json', 'code-maps.json',
  'docs.json', 'team.json', 'annotations.json',
]

export async function GET(request: NextRequest) {
  const projectPath = request.nextUrl.searchParams.get('path')
  if (!projectPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { remote, branch } = getGitInfo(projectPath)
  if (!remote) return NextResponse.json({ error: 'No git remote' }, { status: 400 })

  const repo = repoHash(remote)

  try {
    const [snapshotRes, branchesRes] = await Promise.all([
      fetch(`${DEFAULT_HUB_URL}/snapshot/${repo}/${branch}`),
      fetch(`${DEFAULT_HUB_URL}/branches/${repo}`),
    ])

    const snapshot = await snapshotRes.json()
    const branches = await branchesRes.json()

    return NextResponse.json({
      success: true,
      hubUrl: DEFAULT_HUB_URL,
      remote,
      currentBranch: branch,
      snapshot: snapshotRes.ok ? snapshot : null,
      branches: (branches as { branches: unknown[] }).branches ?? [],
    })
  } catch {
    return NextResponse.json({
      success: true,
      hubUrl: DEFAULT_HUB_URL,
      hubOnline: false,
      remote,
      currentBranch: branch,
    })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { action: string; path: string; branch?: string }
  const { action, path: projectPath, branch: overrideBranch } = body

  if (!projectPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { remote, branch: gitBranch, user } = getGitInfo(projectPath)
  if (!remote) return NextResponse.json({ error: 'No git remote' }, { status: 400 })

  const repo = repoHash(remote)
  const branch = overrideBranch ?? gitBranch
  const weaverDir = path.join(projectPath, '.weaver')

  if (action === 'push') {
    // Collect files
    const files: { name: string; content: string }[] = []
    for (const fileName of SYNC_FILES) {
      const filePath = path.join(weaverDir, fileName)
      if (fs.existsSync(filePath)) {
        files.push({ name: fileName, content: fs.readFileSync(filePath, 'utf-8') })
      }
    }

    // Include recent logs
    const logsDir = path.join(weaverDir, 'logs')
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl')).sort().slice(-2)
      for (const logFile of logFiles) {
        files.push({ name: `logs/${logFile}`, content: fs.readFileSync(path.join(logsDir, logFile), 'utf-8') })
      }
    }

    // Get project name
    let projectName = 'Unknown'
    try {
      const ctx = JSON.parse(fs.readFileSync(path.join(weaverDir, 'context.json'), 'utf-8'))
      projectName = ctx.project?.name ?? 'Unknown'
    } catch {}

    try {
      const res = await fetch(`${DEFAULT_HUB_URL}/snapshot/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, branch, pushedBy: user, projectName, files }),
      })
      const data = await res.json()
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ error: 'Cannot reach Weaver Hub' }, { status: 502 })
    }
  }

  if (action === 'pull') {
    try {
      const res = await fetch(`${DEFAULT_HUB_URL}/snapshot/pull/${repo}/${branch}`)
      const data = await res.json() as { exists?: boolean; files?: { name: string; content: string }[]; meta?: unknown }

      if (!data.exists) {
        return NextResponse.json({ error: `No snapshot for branch "${branch}"` }, { status: 404 })
      }

      fs.mkdirSync(weaverDir, { recursive: true })
      let written = 0
      for (const file of data.files ?? []) {
        const fp = path.join(weaverDir, file.name)
        fs.mkdirSync(path.dirname(fp), { recursive: true })
        fs.writeFileSync(fp, file.content, 'utf-8')
        written++
      }

      return NextResponse.json({ success: true, filesWritten: written, meta: data.meta })
    } catch {
      return NextResponse.json({ error: 'Cannot reach Weaver Hub' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
