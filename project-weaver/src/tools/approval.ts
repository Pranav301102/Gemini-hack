import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { STAGE_NAMES } from '../types.js';

export function registerApproval(server: McpServer): void {

  server.tool(
    'check_approval',
    'Check the current approval gate status. Returns whether the user has approved the architecture and spec.',
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
      const approval = board.approval;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            currentStage: board.pipeline.currentStage,
            approval: approval ?? { status: 'pending' },
            message: approval?.status === 'approved'
              ? 'User has approved. Pipeline can proceed to implementation.'
              : approval?.status === 'changes-requested'
                ? `User requested changes: ${approval.comments ?? 'No comments'}. Reset to architecture stage.`
                : 'Awaiting user approval. The user must approve from the dashboard before the pipeline can continue.',
          }),
        }],
      };
    },
  );

  server.tool(
    'submit_approval',
    'Submit an approval decision for the current pipeline. Used by the dashboard or when the user verbally approves. If approved, pipeline advances to implementation. If changes requested, resets to architecture.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      status: z.enum(['approved', 'changes-requested']).describe('Approval decision'),
      comments: z.string().optional().describe('Comments or change requests from the user'),
      requestedChanges: z.array(z.string()).optional().describe('Specific changes requested'),
    },
    async ({ workspacePath, status, comments, requestedChanges }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      manager.setApproval({
        status,
        reviewedAt: new Date().toISOString(),
        comments,
        requestedChanges,
      });

      if (status === 'approved') {
        manager.advanceStage('approval', 'complete', 'user');
      } else {
        // Changes requested — reset to architecture
        manager.resetToStage('architecture');
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: status === 'approved'
              ? 'Approved! Pipeline will proceed to implementation.'
              : 'Changes requested. Pipeline reset to architecture stage.',
            status,
            comments,
          }),
        }],
      };
    },
  );

  server.tool(
    'get_approval_summary',
    'Get a summary of what the user needs to review before approving. Returns architecture document, spec, stories, and style guide from the context board.',
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

      // Gather artifacts from completed stages
      const architectureArtifacts = board.entries.filter(
        e => e.stage === 'architecture' && (e.type === 'artifact' || e.type === 'decision')
      );
      const specArtifacts = board.entries.filter(
        e => e.stage === 'spec' && e.type === 'artifact'
      );
      const storyArtifacts = board.entries.filter(
        e => e.stage === 'stories' && e.type === 'artifact'
      );
      const styleGuideEntries = board.entries.filter(
        e => e.type === 'decision' && e.metadata?.isStyleGuide
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            project: board.project,
            approval: board.approval ?? { status: 'pending' },
            summary: {
              architecture: architectureArtifacts.map(e => ({ title: e.title, content: e.content.substring(0, 2000) })),
              spec: specArtifacts.map(e => ({ title: e.title, content: e.content.substring(0, 2000) })),
              stories: storyArtifacts.map(e => ({ title: e.title, content: e.content.substring(0, 2000) })),
              styleGuide: styleGuideEntries.map(e => ({ title: e.title, content: e.content.substring(0, 2000) })),
            },
            message: 'Review the architecture, spec, and stories above. Approve from the dashboard or use submit_approval.',
          }),
        }],
      };
    },
  );
}
