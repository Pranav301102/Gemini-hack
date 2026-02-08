import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { AGENT_DISPLAY_NAMES } from '../types.js';

const agentEnum = z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']);
const phaseEnum = z.enum(['read', 'plan', 'ready']);
const entryTypeEnum = z.enum(['brainstorm', 'proposal', 'decision', 'artifact', 'question', 'memory-map']);

export function registerContextBoardTools(server: McpServer): void {

  // --- get_context_board ---
  server.tool(
    'get_context_board',
    'Read the shared context board showing all agent decisions, artifacts, and project status. Use filters to narrow results.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      agent: agentEnum.optional().describe('Filter entries by agent role'),
      phase: phaseEnum.optional().describe('Filter entries by project phase'),
      type: entryTypeEnum.optional().describe('Filter by entry type'),
      limit: z.number().optional().describe('Max entries to return (default 50, newest first)'),
    },
    async ({ workspacePath, agent, phase, type, limit }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project first.' }) }],
        };
      }

      const board = manager.readBoard();
      const entries = manager.getFilteredEntries({ agent, phase, type, limit });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            project: board.project,
            phase: board.phase,
            agents: board.agents,
            entries,
            totalEntries: board.entries.length,
            returnedEntries: entries.length,
            hasPlan: !!board.plan,
          }),
        }],
      };
    },
  );

  // --- update_context_board ---
  server.tool(
    'update_context_board',
    'Write an agent entry to the shared context board. This is how agents communicate observations, proposals, decisions, and artifacts.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      agent: agentEnum.describe('Which agent is writing this entry'),
      phase: phaseEnum.describe('Current project phase'),
      type: entryTypeEnum.describe('Type of entry: brainstorm (discussion), proposal (suggested change), decision (agreed upon), artifact (document/code), question (needs clarification), memory-map (structured change plan)'),
      title: z.string().describe('Brief title summarizing this entry'),
      content: z.string().describe('Detailed content'),
      parentId: z.string().optional().describe('ID of a parent entry if this is a reply/thread'),
      metadata: z.record(z.unknown()).optional().describe('Optional metadata'),
    },
    async ({ workspacePath, agent, phase, type, title, content, parentId, metadata }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const entry = manager.addEntry({ agent, phase, type, title, content, parentId, metadata });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `${AGENT_DISPLAY_NAMES[agent]} recorded ${type}: "${title}"`,
            entryId: entry.id,
          }),
        }],
      };
    },
  );

  // --- get_project_status ---
  server.tool(
    'get_project_status',
    'Get a high-level overview: project phase, agent statuses, plan summary, and statistics.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
    },
    async ({ workspacePath }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const board = manager.readBoard();
      const plan = manager.readPlan();

      // Count entries by type
      const entryCounts = board.entries.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const planSummary = plan ? {
        summary: plan.summary,
        changeGroups: plan.changeGroups.length,
        totalChanges: plan.changeGroups.reduce((sum, g) => sum + g.changes.length, 0),
        filesAffected: plan.fileMap.length,
        discussionEntries: plan.discussion.length,
      } : null;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            project: board.project.name,
            description: board.project.description,
            phase: board.phase,
            hasPlan: !!plan,
            planSummary,
            agents: Object.fromEntries(
              Object.entries(board.agents).map(([role, state]) => [
                role,
                { status: state.status, currentTask: state.currentTask, lastActive: state.lastActive },
              ]),
            ),
            entryCounts,
            totalEntries: board.entries.length,
            lastUpdated: board.updatedAt,
          }),
        }],
      };
    },
  );
}
