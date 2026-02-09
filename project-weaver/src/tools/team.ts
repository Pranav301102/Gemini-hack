import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { BoardManager } from '../context/board.js';

const TEAM_FILE = 'team.json';
const ANNOTATIONS_FILE = 'annotations.json';

// ─── Types ───

interface TeamMember {
  id: string;
  name: string;
  email: string;
  firstSeen: string;
  lastActive: string;
  contributions: {
    scans: number;
    annotations: number;
    reviews: number;
    builds: number;
  };
}

interface TeamState {
  version: string;
  members: TeamMember[];
  sharedNotes: TeamNote[];
  taskClaims: TaskClaim[];
  syncHistory: SyncEvent[];
}

interface TeamNote {
  id: string;
  author: string;       // git name
  authorEmail: string;
  timestamp: string;
  content: string;
  category: 'general' | 'blocker' | 'decision' | 'handoff';
  resolved: boolean;
}

interface TaskClaim {
  changeId: string;
  changeTitle: string;
  claimedBy: string;
  claimedAt: string;
  status: 'claimed' | 'in-progress' | 'done';
}

interface SyncEvent {
  timestamp: string;
  member: string;
  action: 'scan' | 'build' | 'implement' | 'review' | 'annotate';
  details: string;
}

interface CodeAnnotation {
  id: string;
  file: string;
  symbol: string;
  symbolType: 'function' | 'class' | 'type' | 'variable' | 'module';
  line?: number;
  annotation: string;
  tags: string[];
  author: string;         // agent or human
  authorType: 'agent' | 'human';
  verified: boolean;      // human verified
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnnotationsStore {
  version: string;
  annotations: CodeAnnotation[];
}

// ─── Git helpers ───

function getGitUser(workspacePath: string): { name: string; email: string } | null {
  try {
    const name = execSync('git config user.name', { cwd: workspacePath, encoding: 'utf-8' }).trim();
    const email = execSync('git config user.email', { cwd: workspacePath, encoding: 'utf-8' }).trim();
    return { name, email };
  } catch {
    return null;
  }
}

function getGitContributors(workspacePath: string): { name: string; email: string; commits: number }[] {
  try {
    const log = execSync('git log --format="%aN|%aE" --no-merges', { cwd: workspacePath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const counts = new Map<string, { name: string; email: string; commits: number }>();
    for (const line of log.trim().split('\n')) {
      if (!line) continue;
      const [name, email] = line.split('|');
      const key = email || name;
      const existing = counts.get(key);
      if (existing) {
        existing.commits++;
      } else {
        counts.set(key, { name, email, commits: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.commits - a.commits);
  } catch {
    return [];
  }
}

function getGitBranch(workspacePath: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getWeaverFileStatus(workspacePath: string): { tracked: boolean; committed: boolean } {
  try {
    const weaverDir = path.join(workspacePath, '.weaver');
    if (!fs.existsSync(weaverDir)) return { tracked: false, committed: false };
    
    const status = execSync('git status --porcelain .weaver/', { cwd: workspacePath, encoding: 'utf-8' }).trim();
    const lsFiles = execSync('git ls-files .weaver/', { cwd: workspacePath, encoding: 'utf-8' }).trim();
    
    return {
      tracked: lsFiles.length > 0,
      committed: lsFiles.length > 0 && status.length === 0,
    };
  } catch {
    return { tracked: false, committed: false };
  }
}

// ─── File I/O helpers ───

function readTeamState(workspacePath: string): TeamState {
  const filePath = path.join(workspacePath, '.weaver', TEAM_FILE);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return { version: '1.0.0', members: [], sharedNotes: [], taskClaims: [], syncHistory: [] };
}

function writeTeamState(workspacePath: string, state: TeamState): void {
  const filePath = path.join(workspacePath, '.weaver', TEAM_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

function readAnnotations(workspacePath: string): AnnotationsStore {
  const filePath = path.join(workspacePath, '.weaver', ANNOTATIONS_FILE);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return { version: '1.0.0', annotations: [] };
}

function writeAnnotations(workspacePath: string, store: AnnotationsStore): void {
  const filePath = path.join(workspacePath, '.weaver', ANNOTATIONS_FILE);
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Registration ───

export function registerTeam(server: McpServer): void {

  // --- team_status ---
  server.tool(
    'team_status',
    'Get the team collaboration status: git contributors, who has scanned the project, shared .weaver state, annotation counts, and task claims. Use this to understand the team landscape before making changes.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
    },
    async ({ workspacePath }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project first.' }) }] };
      }

      const gitUser = getGitUser(workspacePath);
      const contributors = getGitContributors(workspacePath);
      const branch = getGitBranch(workspacePath);
      const weaverGit = getWeaverFileStatus(workspacePath);
      const team = readTeamState(workspacePath);
      const annotations = readAnnotations(workspacePath);

      // Auto-register current user
      if (gitUser && !team.members.find(m => m.email === gitUser.email)) {
        team.members.push({
          id: crypto.randomUUID(),
          name: gitUser.name,
          email: gitUser.email,
          firstSeen: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          contributions: { scans: 0, annotations: 0, reviews: 0, builds: 0 },
        });
        writeTeamState(workspacePath, team);
      }

      // Update lastActive
      if (gitUser) {
        const member = team.members.find(m => m.email === gitUser.email);
        if (member) {
          member.lastActive = new Date().toISOString();
          writeTeamState(workspacePath, team);
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            currentUser: gitUser,
            branch,
            weaverState: {
              gitTracked: weaverGit.tracked,
              committed: weaverGit.committed,
              hint: !weaverGit.tracked
                ? 'Run "git add .weaver/" to share your project intelligence with the team'
                : weaverGit.committed
                  ? '.weaver is committed — teammates can pull and use your scans'
                  : '.weaver has uncommitted changes — commit to share with team',
            },
            teamMembers: team.members,
            gitContributors: contributors.slice(0, 20),
            annotations: {
              total: annotations.annotations.length,
              verified: annotations.annotations.filter(a => a.verified).length,
              byAgent: annotations.annotations.filter(a => a.authorType === 'agent').length,
              byHuman: annotations.annotations.filter(a => a.authorType === 'human').length,
            },
            taskClaims: team.taskClaims,
            recentSync: team.syncHistory.slice(-10),
            sharedNotes: team.sharedNotes.filter(n => !n.resolved),
          }),
        }],
      };
    },
  );

  // --- record_team_activity ---
  server.tool(
    'record_team_activity',
    'Record a team member activity (scan, build, implement, review, annotate) for collaboration tracking. Called automatically by other tools.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      action: z.enum(['scan', 'build', 'implement', 'review', 'annotate']).describe('Type of activity'),
      details: z.string().describe('Brief description of what was done'),
    },
    async ({ workspacePath, action, details }) => {
      const gitUser = getGitUser(workspacePath);
      const team = readTeamState(workspacePath);

      const memberName = gitUser?.name ?? 'Unknown';
      const member = team.members.find(m => m.email === gitUser?.email);

      if (member) {
        member.lastActive = new Date().toISOString();
        if (action === 'scan') member.contributions.scans++;
        if (action === 'annotate') member.contributions.annotations++;
        if (action === 'review') member.contributions.reviews++;
        if (action === 'build') member.contributions.builds++;
      }

      team.syncHistory.push({
        timestamp: new Date().toISOString(),
        member: memberName,
        action,
        details,
      });

      // Keep last 100 sync events
      if (team.syncHistory.length > 100) {
        team.syncHistory = team.syncHistory.slice(-100);
      }

      writeTeamState(workspacePath, team);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: `Recorded ${action} by ${memberName}` }) }],
      };
    },
  );

  // --- add_team_note ---
  server.tool(
    'add_team_note',
    'Add a shared team note visible to all team members and agents. Use for blockers, decisions, handoffs between team members.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      content: z.string().describe('Note content'),
      category: z.enum(['general', 'blocker', 'decision', 'handoff']).describe('Note category'),
    },
    async ({ workspacePath, content, category }) => {
      const gitUser = getGitUser(workspacePath);
      const team = readTeamState(workspacePath);

      const note: TeamNote = {
        id: crypto.randomUUID(),
        author: gitUser?.name ?? 'Unknown',
        authorEmail: gitUser?.email ?? '',
        timestamp: new Date().toISOString(),
        content,
        category,
        resolved: false,
      };

      team.sharedNotes.push(note);
      writeTeamState(workspacePath, team);

      // Also log it
      const manager = new BoardManager(workspacePath);
      manager.logEvent({ level: 'info', action: 'team_note_added', message: `${note.author} added ${category} note`, data: { noteId: note.id } });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, noteId: note.id, message: `Team note added by ${note.author}` }) }],
      };
    },
  );

  // --- claim_task ---
  server.tool(
    'claim_task',
    'Claim a planned change so other team members know you are working on it. Prevents duplicate work.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      changeId: z.string().describe('ID of the change from the plan'),
      changeTitle: z.string().describe('Title of the change for display'),
    },
    async ({ workspacePath, changeId, changeTitle }) => {
      const gitUser = getGitUser(workspacePath);
      const team = readTeamState(workspacePath);

      // Check if already claimed
      const existing = team.taskClaims.find(c => c.changeId === changeId);
      if (existing && existing.status !== 'done') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `Already claimed by ${existing.claimedBy} (${existing.status})` }) }],
        };
      }

      team.taskClaims.push({
        changeId,
        changeTitle,
        claimedBy: gitUser?.name ?? 'Unknown',
        claimedAt: new Date().toISOString(),
        status: 'claimed',
      });

      writeTeamState(workspacePath, team);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: `${changeTitle} claimed by ${gitUser?.name ?? 'Unknown'}` }) }],
      };
    },
  );

  // --- annotate_code ---
  server.tool(
    'annotate_code',
    'Add a detailed annotation to a code symbol (function, class, type, variable, or module). Annotations explain what the symbol does, how it is used, design decisions behind it, and edge cases — like an experienced developer would write in their notes. These are shared with the entire team and can be verified by humans.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      file: z.string().describe('Relative file path'),
      symbol: z.string().describe('Name of the function, class, type, or variable'),
      symbolType: z.enum(['function', 'class', 'type', 'variable', 'module']).describe('What kind of symbol'),
      line: z.number().optional().describe('Line number for precise location'),
      annotation: z.string().describe('Detailed annotation explaining: what this does, how it is used, design intent, edge cases, gotchas'),
      tags: z.array(z.string()).optional().describe('Tags for categorization (e.g., "auth", "critical-path", "tech-debt", "perf-sensitive")'),
      agent: z.string().optional().describe('Which agent is writing this annotation'),
    },
    async ({ workspacePath, file, symbol, symbolType, line, annotation, tags, agent }) => {
      const gitUser = getGitUser(workspacePath);
      const store = readAnnotations(workspacePath);

      // Update existing or create new
      const existing = store.annotations.find(a => a.file === file && a.symbol === symbol);
      if (existing) {
        existing.annotation = annotation;
        existing.tags = tags ?? existing.tags;
        existing.updatedAt = new Date().toISOString();
        existing.line = line ?? existing.line;
        // If human edits an agent annotation, mark verified
        if (existing.authorType === 'agent' && !agent) {
          existing.verified = true;
          existing.verifiedBy = gitUser?.name;
        }
      } else {
        store.annotations.push({
          id: crypto.randomUUID(),
          file,
          symbol,
          symbolType,
          line,
          annotation,
          tags: tags ?? [],
          author: agent ?? gitUser?.name ?? 'Unknown',
          authorType: agent ? 'agent' : 'human',
          verified: !agent, // human-written = auto-verified
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      writeAnnotations(workspacePath, store);

      // Log the event
      const manager = new BoardManager(workspacePath);
      manager.logEvent({
        level: 'info',
        action: 'code_annotated',
        message: `${agent ?? gitUser?.name ?? 'Unknown'} annotated ${symbolType} "${symbol}" in ${file}`,
        data: { file, symbol, symbolType },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Annotated ${symbolType} "${symbol}" in ${file}`,
            verified: !agent,
            total: store.annotations.length,
          }),
        }],
      };
    },
  );

  // --- verify_annotation ---
  server.tool(
    'verify_annotation',
    'Mark an agent-written code annotation as human-verified. This confirms the annotation is accurate and trustworthy for the whole team.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      annotationId: z.string().describe('ID of the annotation to verify'),
      correction: z.string().optional().describe('Optional correction to the annotation text'),
    },
    async ({ workspacePath, annotationId, correction }) => {
      const gitUser = getGitUser(workspacePath);
      const store = readAnnotations(workspacePath);

      const annotation = store.annotations.find(a => a.id === annotationId);
      if (!annotation) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Annotation not found' }) }] };
      }

      annotation.verified = true;
      annotation.verifiedBy = gitUser?.name ?? 'Unknown';
      annotation.updatedAt = new Date().toISOString();
      if (correction) {
        annotation.annotation = correction;
      }

      writeAnnotations(workspacePath, store);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: `Annotation verified by ${annotation.verifiedBy}`, symbol: annotation.symbol }) }],
      };
    },
  );

  // --- get_annotations ---
  server.tool(
    'get_annotations',
    'Get all code annotations, optionally filtered by file or tag. Returns detailed notes about how code works, written by agents and verified by humans.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      file: z.string().optional().describe('Filter by file path'),
      tag: z.string().optional().describe('Filter by tag'),
      verifiedOnly: z.boolean().optional().describe('Only return human-verified annotations'),
    },
    async ({ workspacePath, file, tag, verifiedOnly }) => {
      const store = readAnnotations(workspacePath);

      let filtered = store.annotations;
      if (file) filtered = filtered.filter(a => a.file === file);
      if (tag) filtered = filtered.filter(a => a.tags.includes(tag));
      if (verifiedOnly) filtered = filtered.filter(a => a.verified);

      // Group by file for readability
      const byFile = new Map<string, CodeAnnotation[]>();
      for (const a of filtered) {
        const arr = byFile.get(a.file) ?? [];
        arr.push(a);
        byFile.set(a.file, arr);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            totalAnnotations: filtered.length,
            verified: filtered.filter(a => a.verified).length,
            unverified: filtered.filter(a => !a.verified).length,
            files: Object.fromEntries(byFile),
          }),
        }],
      };
    },
  );
}
