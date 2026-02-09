import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { BoardManager } from '../context/board.js';

const DEFAULT_HUB_URL = 'http://localhost:4200';

// ─── Git helpers ───

function getGitRemote(workspacePath: string): string | null {
  try {
    return execSync('git config --get remote.origin.url', { cwd: workspacePath, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function getGitBranch(workspacePath: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath, encoding: 'utf-8' }).trim();
  } catch {
    return 'main';
  }
}

function getGitUser(workspacePath: string): string {
  try {
    return execSync('git config user.name', { cwd: workspacePath, encoding: 'utf-8' }).trim();
  } catch {
    return 'Unknown';
  }
}

function repoHash(repoUrl: string): string {
  return crypto.createHash('sha256').update(repoUrl.trim().toLowerCase()).digest('hex').slice(0, 16);
}

// Files to sync
const SYNC_FILES = [
  'context.json',
  'index.json',
  'plan.json',
  'code-maps.json',
  'docs.json',
  'team.json',
  'annotations.json',
];

// ─── Registration ───

export function registerSync(server: McpServer): void {

  // --- sync_push ---
  server.tool(
    'sync_push',
    'Push the local .weaver project intelligence to the Weaver Hub server so teammates on the same branch can pull it. Syncs context, index, plan, code maps, docs, team state, and annotations.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      hubUrl: z.string().optional().describe(`Hub server URL (default: ${DEFAULT_HUB_URL})`),
    },
    async ({ workspacePath, hubUrl }) => {
      const hub = hubUrl ?? DEFAULT_HUB_URL;
      const remote = getGitRemote(workspacePath);
      const branch = getGitBranch(workspacePath);
      const user = getGitUser(workspacePath);

      if (!remote) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No git remote found. Initialize a git repo with a remote first.' }) }] };
      }

      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No .weaver project found. Run init_project first.' }) }] };
      }

      const weaverDir = path.join(workspacePath, '.weaver');

      // Collect files to push
      const files: { name: string; content: string }[] = [];
      for (const fileName of SYNC_FILES) {
        const filePath = path.join(weaverDir, fileName);
        if (fs.existsSync(filePath)) {
          files.push({
            name: fileName,
            content: fs.readFileSync(filePath, 'utf-8'),
          });
        }
      }

      // Also include log files (last 2 days)
      const logsDir = path.join(weaverDir, 'logs');
      if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl')).sort().slice(-2);
        for (const logFile of logFiles) {
          files.push({
            name: `logs/${logFile}`,
            content: fs.readFileSync(path.join(logsDir, logFile), 'utf-8'),
          });
        }
      }

      if (files.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No .weaver files to push.' }) }] };
      }

      // Get project name
      const board = manager.readBoard();
      const projectName = board.project?.name ?? 'Unknown';

      // Push to hub
      try {
        const res = await fetch(`${hub}/snapshot/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: repoHash(remote),
            branch,
            pushedBy: user,
            projectName,
            files,
          }),
        });

        const data = await res.json() as { success?: boolean; version?: number; filesWritten?: number; totalSize?: number; message?: string; error?: string };

        if (!res.ok) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: data.error ?? 'Push failed' }) }] };
        }

        // Log the sync event
        manager.logEvent({
          level: 'info',
          action: 'sync_push',
          message: `Pushed v${data.version} to hub (${files.length} files)`,
          data: { branch, version: data.version, user },
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              version: data.version,
              filesPushed: data.filesWritten,
              totalSize: data.totalSize,
              branch,
              remote,
              message: `🚀 Pushed to Weaver Hub! Teammates on branch "${branch}" can now pull your scans, plan, and annotations.`,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              message: `Cannot reach hub at ${hub}. Is it running? Start with: cd hub && npm start`,
              error: err instanceof Error ? err.message : String(err),
            }),
          }],
        };
      }
    },
  );

  // --- sync_pull ---
  server.tool(
    'sync_pull',
    'Pull the latest .weaver project intelligence from the Weaver Hub server. This downloads the shared context, index, plan, code maps, docs, team state, and annotations that teammates have pushed.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      branch: z.string().optional().describe('Branch to pull from (defaults to current git branch)'),
      hubUrl: z.string().optional().describe(`Hub server URL (default: ${DEFAULT_HUB_URL})`),
    },
    async ({ workspacePath, branch: overrideBranch, hubUrl }) => {
      const hub = hubUrl ?? DEFAULT_HUB_URL;
      const remote = getGitRemote(workspacePath);
      const branch = overrideBranch ?? getGitBranch(workspacePath);

      if (!remote) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No git remote found.' }) }] };
      }

      const repo = repoHash(remote);

      try {
        const res = await fetch(`${hub}/snapshot/pull/${repo}/${branch}`);
        const data = await res.json() as { exists?: boolean; message?: string; meta?: { version: number; pushedBy: string; pushedAt: string }; files?: { name: string; content: string }[] };

        if (!res.ok || !data.exists) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: data.message ?? `No snapshot found for branch "${branch}"` }) }] };
        }

        const weaverDir = path.join(workspacePath, '.weaver');
        fs.mkdirSync(weaverDir, { recursive: true });

        // Write files
        let filesWritten = 0;
        for (const file of data.files ?? []) {
          const filePath = path.join(weaverDir, file.name);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content, 'utf-8');
          filesWritten++;
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              branch,
              version: data.meta?.version,
              pushedBy: data.meta?.pushedBy,
              pushedAt: data.meta?.pushedAt,
              filesReceived: filesWritten,
              message: `📥 Pulled v${data.meta?.version} from hub (${filesWritten} files). Your .weaver/ is now synced with branch "${branch}".`,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              message: `Cannot reach hub at ${hub}. Start with: cd hub && npm start`,
              error: err instanceof Error ? err.message : String(err),
            }),
          }],
        };
      }
    },
  );

  // --- sync_status ---
  server.tool(
    'sync_status',
    'Check the sync status between your local .weaver and the Weaver Hub. Shows version, last push, available branches, and which teammates have contributed.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      hubUrl: z.string().optional().describe(`Hub server URL (default: ${DEFAULT_HUB_URL})`),
    },
    async ({ workspacePath, hubUrl }) => {
      const hub = hubUrl ?? DEFAULT_HUB_URL;
      const remote = getGitRemote(workspacePath);
      const branch = getGitBranch(workspacePath);

      if (!remote) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No git remote found.' }) }] };
      }

      const repo = repoHash(remote);

      try {
        // Get current branch snapshot
        const snapshotRes = await fetch(`${hub}/snapshot/${repo}/${branch}`);
        const snapshotData = await snapshotRes.json() as { exists: boolean; meta?: { version: number; pushedBy: string; pushedAt: string; projectName: string; filesIncluded: string[]; pushHistory: { by: string; at: string; version: number }[] } };

        // Get all branches
        const branchesRes = await fetch(`${hub}/branches/${repo}`);
        const branchesData = await branchesRes.json() as { branches: { branch: string; meta: { version: number; pushedBy: string; pushedAt: string } | null }[] };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              hubUrl: hub,
              remote,
              currentBranch: branch,
              snapshot: snapshotData.exists ? {
                version: snapshotData.meta?.version,
                pushedBy: snapshotData.meta?.pushedBy,
                pushedAt: snapshotData.meta?.pushedAt,
                project: snapshotData.meta?.projectName,
                files: snapshotData.meta?.filesIncluded,
                recentPushes: snapshotData.meta?.pushHistory?.slice(-5),
              } : null,
              availableBranches: branchesData.branches.map(b => ({
                branch: b.branch,
                version: b.meta?.version,
                lastPush: b.meta?.pushedAt,
              })),
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              hubStatus: 'offline',
              message: `Hub at ${hub} is not reachable. Start with: cd hub && npm start`,
            }),
          }],
        };
      }
    },
  );
}
