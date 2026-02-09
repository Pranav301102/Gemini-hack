/**
 * Weaver Hub — Central Sync Server
 * 
 * Stores .weaver project intelligence snapshots keyed by:
 *   repo (git remote URL) + branch
 * 
 * Teams push/pull .weaver state so everyone shares the same
 * code index, plan, annotations, and agent memory.
 * 
 * Storage: ~/.weaver-hub/<repo-hash>/<branch>/
 *   context.json, index.json, plan.json, code-maps.json,
 *   docs.json, team.json, annotations.json, meta.json
 */

import express from 'express';
import cors from 'cors';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const HUB_ROOT = process.env.WEAVER_HUB_DIR ?? path.join(os.homedir(), '.weaver-hub');
const PORT = parseInt(process.env.PORT ?? '4200', 10);

// Ensure hub root exists
fs.mkdirSync(HUB_ROOT, { recursive: true });

// ─── Helpers ───

function repoHash(repoUrl: string): string {
  return crypto.createHash('sha256').update(repoUrl.trim().toLowerCase()).digest('hex').slice(0, 16);
}

function sanitizeBranch(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getBranchDir(repo: string, branch: string): string {
  return path.join(HUB_ROOT, repoHash(repo), sanitizeBranch(branch));
}

interface SnapshotMeta {
  repo: string;
  branch: string;
  pushedBy: string;
  pushedAt: string;
  projectName: string;
  filesIncluded: string[];
  size: number;
  version: number;
  pushHistory: { by: string; at: string; version: number }[];
}

function readMeta(dir: string): SnapshotMeta | null {
  const metaPath = path.join(dir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }
  return null;
}

// ─── Routes ───

// Health check
app.get('/health', (_req, res) => {
  const repos = fs.existsSync(HUB_ROOT)
    ? fs.readdirSync(HUB_ROOT).filter(f => fs.statSync(path.join(HUB_ROOT, f)).isDirectory()).length
    : 0;

  res.json({
    status: 'ok',
    hub: 'weaver-hub',
    version: '1.0.0',
    repos,
    storage: HUB_ROOT,
  });
});

// List all repos and branches
app.get('/repos', (_req, res) => {
  const repos: { repoHash: string; branches: { branch: string; meta: SnapshotMeta | null }[] }[] = [];

  if (fs.existsSync(HUB_ROOT)) {
    for (const repoDir of fs.readdirSync(HUB_ROOT)) {
      const repoPath = path.join(HUB_ROOT, repoDir);
      if (!fs.statSync(repoPath).isDirectory()) continue;

      const branches: { branch: string; meta: SnapshotMeta | null }[] = [];
      for (const branchDir of fs.readdirSync(repoPath)) {
        const branchPath = path.join(repoPath, branchDir);
        if (!fs.statSync(branchPath).isDirectory()) continue;
        branches.push({
          branch: branchDir,
          meta: readMeta(branchPath),
        });
      }

      if (branches.length > 0) {
        repos.push({ repoHash: repoDir, branches });
      }
    }
  }

  res.json({ repos });
});

// Get snapshot status for a repo+branch
app.get('/snapshot/:repo/:branch', (req, res) => {
  const dir = getBranchDir(req.params.repo, req.params.branch);
  const meta = readMeta(dir);

  if (!meta) {
    return res.status(404).json({ exists: false, message: 'No snapshot found for this repo/branch' });
  }

  res.json({ exists: true, meta });
});

// Push .weaver snapshot
app.post('/snapshot/push', (req, res) => {
  const { repo, branch, pushedBy, projectName, files } = req.body as {
    repo: string;
    branch: string;
    pushedBy: string;
    projectName: string;
    files: { name: string; content: string }[];
  };

  if (!repo || !branch || !files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Missing required fields: repo, branch, files' });
  }

  const dir = getBranchDir(repo, branch);
  fs.mkdirSync(dir, { recursive: true });

  // Read existing meta for version tracking
  const existingMeta = readMeta(dir);
  const version = (existingMeta?.version ?? 0) + 1;

  // Write each file
  let totalSize = 0;
  const fileNames: string[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    // Ensure subdirectory exists (for logs/ etc)
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, 'utf-8');
    totalSize += Buffer.byteLength(file.content, 'utf-8');
    fileNames.push(file.name);
  }

  // Update meta
  const pushHistory = existingMeta?.pushHistory ?? [];
  pushHistory.push({ by: pushedBy, at: new Date().toISOString(), version });

  // Keep last 50 push events
  if (pushHistory.length > 50) {
    pushHistory.splice(0, pushHistory.length - 50);
  }

  const meta: SnapshotMeta = {
    repo,
    branch,
    pushedBy,
    pushedAt: new Date().toISOString(),
    projectName: projectName ?? 'Unknown',
    filesIncluded: fileNames,
    size: totalSize,
    version,
    pushHistory,
  };

  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  console.log(`[push] ${pushedBy} → ${repo}@${branch} (v${version}, ${fileNames.length} files, ${(totalSize / 1024).toFixed(1)}KB)`);

  res.json({
    success: true,
    version,
    filesWritten: fileNames.length,
    totalSize,
    message: `Snapshot v${version} pushed by ${pushedBy}`,
  });
});

// Pull .weaver snapshot
app.get('/snapshot/pull/:repo/:branch', (req, res) => {
  const dir = getBranchDir(req.params.repo, req.params.branch);
  const meta = readMeta(dir);

  if (!meta) {
    return res.status(404).json({ exists: false, message: 'No snapshot found' });
  }

  // Read all .weaver files
  const files: { name: string; content: string }[] = [];

  function readDir(dirPath: string, prefix: string) {
    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      const relativeName = prefix ? `${prefix}/${entry}` : entry;
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        readDir(fullPath, relativeName);
      } else if (entry !== 'meta.json') {
        files.push({
          name: relativeName,
          content: fs.readFileSync(fullPath, 'utf-8'),
        });
      }
    }
  }

  readDir(dir, '');

  console.log(`[pull] ${req.params.repo}@${req.params.branch} → ${files.length} files`);

  res.json({
    exists: true,
    meta,
    files,
  });
});

// List branches for a repo
app.get('/branches/:repo', (req, res) => {
  const repoDir = path.join(HUB_ROOT, req.params.repo);

  if (!fs.existsSync(repoDir)) {
    return res.json({ branches: [] });
  }

  const branches = fs.readdirSync(repoDir)
    .filter(f => fs.statSync(path.join(repoDir, f)).isDirectory())
    .map(branch => ({
      branch,
      meta: readMeta(path.join(repoDir, branch)),
    }));

  res.json({ branches });
});

// Delete a snapshot
app.delete('/snapshot/:repo/:branch', (req, res) => {
  const dir = getBranchDir(req.params.repo, req.params.branch);

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Snapshot not found' });
  }

  fs.rmSync(dir, { recursive: true });
  console.log(`[delete] ${req.params.repo}@${req.params.branch}`);
  res.json({ success: true, message: 'Snapshot deleted' });
});

// ─── Start ───

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │         🕸️  Weaver Hub — Sync Server        │
  │                                             │
  │  Endpoint:  http://localhost:${PORT}            │
  │  Storage:   ${HUB_ROOT}  │
  │                                             │
  │  Teams push/pull .weaver intelligence       │
  │  keyed by git repo + branch                 │
  └─────────────────────────────────────────────┘
  `);
});
