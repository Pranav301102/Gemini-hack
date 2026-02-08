import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { getAgentPrompt } from '../agents/index.js';
import { AGENT_DISPLAY_NAMES } from '../types.js';
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
        // Update agent state to working
        manager.updateAgentState(agent, {
            status: 'working',
            currentTask: task,
        });
        manager.logEvent({
            level: 'info',
            agent,
            phase: board.phase,
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
                        currentPhase: board.phase,
                        recentEntries: board.entries.slice(-10),
                        instruction: `You are now acting as the ${AGENT_DISPLAY_NAMES[agent]}. Follow the role context above to complete this task: "${task}". Use add_proposed_change and add_brainstorm_entry to record your work.`,
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