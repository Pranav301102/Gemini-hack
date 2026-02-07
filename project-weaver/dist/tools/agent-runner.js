import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { getAgentPrompt } from '../agents/index.js';
import { AGENT_DISPLAY_NAMES, STAGE_AGENT_MAP } from '../types.js';
const agentEnum = z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']);
export function registerAgentRunner(server) {
    // --- assign_agent ---
    server.tool('assign_agent', "Assign a task to a specific agent. Returns the agent's role context, project info, and recent context board entries so Gemini can reason as that agent.", {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.describe('Which agent to activate'),
        task: z.string().describe('The task to assign to this agent'),
        context: z.string().optional().describe('Additional context from previous agents or the user'),
    }, async ({ workspacePath, agent, task, context }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        // Guard: approval stage is user-driven, no agent assignment
        if (board.pipeline.currentStage === 'approval') {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: 'The approval stage is a user gate — no agent can be assigned. Use check_approval or get_approval_summary instead.',
                        }),
                    }],
            };
        }
        // Update agent state to working
        manager.updateAgentState(agent, {
            status: 'working',
            currentTask: task,
        });
        // Mark the current stage as in-progress if this agent owns it
        const currentStage = board.pipeline.currentStage;
        if (STAGE_AGENT_MAP[currentStage] === agent) {
            manager.advanceStage(currentStage, 'in-progress', agent);
        }
        manager.logEvent({
            level: 'info',
            agent,
            stage: board.pipeline.currentStage,
            action: 'agent_assigned',
            message: `${AGENT_DISPLAY_NAMES[agent]} assigned: ${task}`,
        });
        // Build the full agent prompt with project context
        const agentPrompt = getAgentPrompt(agent, board.project, board.entries, context);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        agent,
                        displayName: AGENT_DISPLAY_NAMES[agent],
                        task,
                        roleContext: agentPrompt,
                        projectContext: board.project,
                        currentStage: board.pipeline.currentStage,
                        recentEntries: board.entries.slice(-10),
                        instruction: `You are now acting as the ${AGENT_DISPLAY_NAMES[agent]}. Follow the role context above to complete this task: "${task}". When finished, use update_context_board to record your output as an "artifact" entry, then use update_context_board with type="handoff" to pass context to the next agent.`,
                    }),
                }],
        };
    });
    // --- complete_agent_task ---
    server.tool('complete_agent_task', "Mark an agent's current task as done and update their status.", {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.describe('Which agent completed their task'),
        summary: z.string().optional().describe('Brief summary of what was accomplished'),
    }, async ({ workspacePath, agent, summary }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        manager.updateAgentState(agent, {
            status: 'done',
            currentTask: undefined,
            output: summary,
        });
        manager.logEvent({
            level: 'info',
            agent,
            action: 'agent_completed',
            message: `${AGENT_DISPLAY_NAMES[agent]} completed task${summary ? ': ' + summary : ''}`,
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `${AGENT_DISPLAY_NAMES[agent]} marked as done.`,
                    }),
                }],
        };
    });
    // --- request_revision ---
    server.tool('request_revision', 'Code Reviewer sends work back to the Developer with specific feedback. Resets the pipeline to implementation stage and creates a feedback entry. Max 2 revision cycles. Can also be triggered from the approval stage to reset to architecture.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        feedback: z.string().describe('Specific feedback on what needs to change'),
        files: z.array(z.string()).optional().describe('Specific files that need revision'),
        severity: z.enum(['minor', 'major', 'critical']).optional().describe('Severity of the issues found'),
    }, async ({ workspacePath, feedback, files, severity }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const currentStage = board.pipeline.currentStage;
        // If called from approval stage, reset to architecture instead
        if (currentStage === 'approval') {
            manager.resetToStage('architecture');
            manager.addEntry({
                agent: 'code-reviewer',
                stage: 'approval',
                type: 'feedback',
                title: 'Approval Rejection',
                content: feedback,
                metadata: { files: files ?? [], severity: severity ?? 'major', source: 'approval' },
            });
            manager.logEvent({
                level: 'warn',
                stage: 'approval',
                action: 'approval_rejected',
                message: `Approval rejected: ${feedback.substring(0, 100)}`,
                data: { files, severity },
            });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Approval rejected. Pipeline reset to architecture stage.',
                            feedback,
                            instruction: 'Pipeline has been reset to the architecture stage. Re-assign the Architect to address the feedback.',
                        }),
                    }],
            };
        }
        // Count existing revision cycles to prevent infinite loops
        const revisionEntries = board.entries.filter(e => e.type === 'feedback' && e.agent === 'code-reviewer' && e.title.startsWith('Revision Request'));
        if (revisionEntries.length >= 2) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: 'Maximum revision cycles (2) reached. Approve with remaining notes or record as known issues.',
                        }),
                    }],
            };
        }
        // Reset Developer to working state
        manager.updateAgentState('developer', {
            status: 'working',
            currentTask: `Address revision feedback (cycle ${revisionEntries.length + 1})`,
        });
        // Reset QA to idle (will need to re-test)
        manager.updateAgentState('qa', { status: 'idle', currentTask: undefined });
        // Move pipeline back to implementation using resetToStage
        manager.resetToStage('implementation');
        // Record feedback entry on the context board
        manager.addEntry({
            agent: 'code-reviewer',
            stage: 'review',
            type: 'feedback',
            title: `Revision Request #${revisionEntries.length + 1}`,
            content: feedback,
            metadata: { files: files ?? [], severity: severity ?? 'major', revisionCycle: revisionEntries.length + 1 },
        });
        manager.logEvent({
            level: 'warn',
            agent: 'code-reviewer',
            stage: 'review',
            action: 'revision_requested',
            message: `Code Reviewer requested revision #${revisionEntries.length + 1}: ${feedback.substring(0, 100)}`,
            data: { files, severity },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Revision #${revisionEntries.length + 1} requested. Developer re-activated.`,
                        revisionCycle: revisionEntries.length + 1,
                        maxCycles: 2,
                        feedback,
                        affectedFiles: files ?? [],
                        instruction: 'Pipeline has been reset to implementation stage. Re-assign the Developer agent to address the feedback, then re-run testing and review.',
                    }),
                }],
        };
    });
    // --- get_agent_status ---
    server.tool('get_agent_status', 'Check what each agent is currently doing, their status, and last activity.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.optional().describe('Specific agent to check, or omit for all agents'),
    }, async ({ workspacePath, agent }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const agents = agent
            ? { [agent]: board.agents[agent] }
            : board.agents;
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, agents }),
                }],
        };
    });
}
//# sourceMappingURL=agent-runner.js.map