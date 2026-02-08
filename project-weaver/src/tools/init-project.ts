import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';

export function registerInitProject(server: McpServer): void {
  server.tool(
    'init_project',
    'Initialize a .weaver/ directory in the workspace with a shared context board for the AI Software Agency. Run this before any other weaver tools.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      projectName: z.string().describe('Name of the software project to build'),
      description: z.string().describe('Brief description of what the project should do'),
      requirements: z.array(z.string()).optional().describe('List of high-level requirements'),
      techStack: z.array(z.string()).optional().describe('Preferred technologies (e.g., ["React", "TypeScript", "Node.js"])'),
    },
    async ({ workspacePath, projectName, description, requirements, techStack }) => {
      const manager = new BoardManager(workspacePath);

      if (manager.exists()) {
        const board = manager.readBoard();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Project "${board.project.name}" already initialized. Use get_context_board to see current state.`,
              projectId: board.projectId,
              project: board.project,
            }),
          }],
        };
      }

      const board = manager.initProject(
        projectName,
        description,
        requirements ?? [],
        techStack ?? [],
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Project "${projectName}" initialized at ${workspacePath}/.weaver/`,
            projectId: board.projectId,
            structure: {
              contextBoard: '.weaver/context.json',
              logs: '.weaver/logs/',
              artifacts: '.weaver/artifacts/',
            },
            nextStep: 'Use read_project to scan the codebase, or run_plan to start planning.',
          }),
        }],
      };
    },
  );

  // --- gather_requirements ---
  server.tool(
    'gather_requirements',
    'Get a structured set of questions to ask the user before planning. Only use for NEW projects (no existing codebase). Store answers using update_project_context.',
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
      const questions = manager.getRequirementsQuestions();

      // Mark questions as answered if we already have project context
      const project = board.project;
      if (project.description && project.description.length > 20) questions[0].answered = true;
      if (project.targetUsers) questions[1].answered = true;
      if (project.requirements.length >= 2) { questions[2].answered = true; questions[3].answered = true; }
      if (project.techStack && project.techStack.length > 0) questions[4].answered = true;
      if (project.existingIntegrations) questions[5].answered = true;
      if (project.constraints && project.constraints.length > 0) questions[6].answered = true;
      if (project.deploymentTarget) questions[8].answered = true;

      const unanswered = questions.filter(q => !q.answered);

      manager.logEvent({
        level: 'info',
        agent: 'product-manager',
        phase: 'plan',
        action: 'requirements_gathering',
        message: `Requirements gathering started: ${unanswered.length} questions remaining`,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            questions,
            unansweredCount: unanswered.length,
            answeredCount: questions.length - unanswered.length,
            instruction: unanswered.length > 0
              ? `Ask the user these ${unanswered.length} questions one at a time. After each answer, use update_project_context to store it. When done, proceed with run_plan.`
              : 'All requirements gathered! Proceed with run_plan.',
          }),
        }],
      };
    },
  );

  // --- update_project_context ---
  server.tool(
    'update_project_context',
    'Update the project context with gathered requirements. Use this after asking the user questions via gather_requirements.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      name: z.string().optional().describe('Updated project name'),
      description: z.string().optional().describe('Updated project description'),
      requirements: z.array(z.string()).optional().describe('Updated or additional requirements'),
      techStack: z.array(z.string()).optional().describe('Technology stack choices'),
      constraints: z.array(z.string()).optional().describe('Project constraints'),
      targetUsers: z.string().optional().describe('Target user description'),
      deploymentTarget: z.string().optional().describe('Deployment target (web, CLI, mobile, etc.)'),
      existingIntegrations: z.string().optional().describe('Existing code/APIs to integrate'),
    },
    async ({ workspacePath, ...updates }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      );

      // Merge requirements arrays rather than replacing
      if (cleanUpdates.requirements) {
        const board = manager.readBoard();
        const existing = board.project.requirements ?? [];
        const newReqs = cleanUpdates.requirements as string[];
        cleanUpdates.requirements = [...new Set([...existing, ...newReqs])];
      }

      manager.updateProjectContext(cleanUpdates);

      manager.logEvent({
        level: 'info',
        agent: 'product-manager',
        phase: 'plan',
        action: 'project_context_updated',
        message: `Project context updated: ${Object.keys(cleanUpdates).join(', ')}`,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Project context updated with: ${Object.keys(cleanUpdates).join(', ')}`,
            updatedFields: Object.keys(cleanUpdates),
          }),
        }],
      };
    },
  );
}
