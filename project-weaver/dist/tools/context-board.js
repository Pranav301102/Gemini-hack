import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { AGENT_DISPLAY_NAMES } from '../types.js';
const agentEnum = z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']);
const stageEnum = z.enum(['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship']);
const entryTypeEnum = z.enum(['decision', 'artifact', 'question', 'feedback', 'handoff']);
export function registerContextBoardTools(server) {
    // --- get_context_board ---
    server.tool('get_context_board', 'Read the shared context board showing all agent decisions, artifacts, and pipeline status. Use filters to narrow results.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.optional().describe('Filter entries by agent role'),
        stage: stageEnum.optional().describe('Filter entries by pipeline stage'),
        type: entryTypeEnum.optional().describe('Filter by entry type'),
        limit: z.number().optional().describe('Max entries to return (default 50, newest first)'),
    }, async ({ workspacePath, agent, stage, type, limit }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project first.' }) }],
            };
        }
        const board = manager.readBoard();
        const entries = manager.getFilteredEntries({ agent, stage, type, limit });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        project: board.project,
                        pipeline: board.pipeline,
                        agents: board.agents,
                        entries,
                        totalEntries: board.entries.length,
                        returnedEntries: entries.length,
                    }),
                }],
        };
    });
    // --- update_context_board ---
    server.tool('update_context_board', 'Write an agent decision, artifact, question, feedback, or handoff to the shared context board. This is how agents communicate.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.describe('Which agent is writing this entry'),
        stage: stageEnum.describe('Current pipeline stage'),
        type: entryTypeEnum.describe('Type of entry: decision (key choice made), artifact (code/doc produced), question (needs clarification), feedback (review/bug), handoff (pass to next agent)'),
        title: z.string().describe('Brief title summarizing this entry'),
        content: z.string().describe('Detailed content - user stories, architecture docs, code, test results, review feedback, etc.'),
        parentId: z.string().optional().describe('ID of a parent entry if this is a reply/thread'),
    }, async ({ workspacePath, agent, stage, type, title, content, parentId }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const entry = manager.addEntry({ agent, stage, type, title, content, parentId });
        // If it's a handoff, also update the pipeline stage
        if (type === 'handoff') {
            manager.advanceStage(stage, 'complete', agent);
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `${AGENT_DISPLAY_NAMES[agent]} recorded ${type}: "${title}"`,
                        entryId: entry.id,
                    }),
                }],
        };
    });
    // --- get_project_status ---
    server.tool('get_project_status', 'Get a high-level overview: pipeline progress, agent statuses, and summary statistics.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const completedStages = Object.values(board.pipeline.stages).filter(s => s.status === 'complete').length;
        const totalStages = Object.keys(board.pipeline.stages).length;
        // Count entries by type
        const entryCounts = board.entries.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {});
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        project: board.project.name,
                        description: board.project.description,
                        currentStage: board.pipeline.currentStage,
                        progress: `${completedStages}/${totalStages} stages complete`,
                        pipeline: board.pipeline.stages,
                        agents: Object.fromEntries(Object.entries(board.agents).map(([role, state]) => [
                            role,
                            { status: state.status, currentTask: state.currentTask, lastActive: state.lastActive },
                        ])),
                        entryCounts,
                        totalEntries: board.entries.length,
                        lastUpdated: board.updatedAt,
                    }),
                }],
        };
    });
}
//# sourceMappingURL=context-board.js.map