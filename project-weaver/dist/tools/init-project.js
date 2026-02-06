import { z } from 'zod';
import { BoardManager } from '../context/board.js';
export function registerInitProject(server) {
    server.tool('init_project', 'Initialize a .weaver/ directory in the workspace with a shared context board for the AI Software Agency. Run this before any other weaver tools.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        projectName: z.string().describe('Name of the software project to build'),
        description: z.string().describe('Brief description of what the project should do'),
        requirements: z.array(z.string()).optional().describe('List of high-level requirements'),
        techStack: z.array(z.string()).optional().describe('Preferred technologies (e.g., ["React", "TypeScript", "Node.js"])'),
    }, async ({ workspacePath, projectName, description, requirements, techStack }) => {
        const manager = new BoardManager(workspacePath);
        if (manager.exists()) {
            const board = manager.readBoard();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Project "${board.project.name}" already initialized. Use get_context_board to see current state.`,
                            projectId: board.projectId,
                            project: board.project,
                        }),
                    }],
            };
        }
        const board = manager.initProject(projectName, description, requirements ?? [], techStack ?? []);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Project "${projectName}" initialized at ${workspacePath}/.weaver/`,
                        projectId: board.projectId,
                        structure: {
                            contextBoard: '.weaver/context.json',
                            logs: '.weaver/logs/',
                            artifacts: '.weaver/artifacts/',
                        },
                        nextStep: 'Use gather_requirements to ask the user clarifying questions, then run_pipeline to execute the full development lifecycle.',
                    }),
                }],
        };
    });
    // --- gather_requirements ---
    server.tool('gather_requirements', 'Get a structured set of questions to ask the user before starting the pipeline. The PM agent should ask these questions to gather complete project context. Store answers using update_project_context.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const questions = manager.getRequirementsQuestions();
        // Mark questions as answered if we already have project context
        const project = board.project;
        if (project.description && project.description.length > 20)
            questions[0].answered = true;
        if (project.targetUsers)
            questions[1].answered = true;
        if (project.requirements.length >= 2) {
            questions[2].answered = true;
            questions[3].answered = true;
        }
        if (project.techStack && project.techStack.length > 0)
            questions[4].answered = true;
        if (project.existingIntegrations)
            questions[5].answered = true;
        if (project.constraints && project.constraints.length > 0)
            questions[6].answered = true;
        if (project.deploymentTarget)
            questions[8].answered = true;
        const unanswered = questions.filter(q => !q.answered);
        manager.logEvent({
            level: 'info',
            agent: 'product-manager',
            stage: 'spec',
            action: 'requirements_gathering',
            message: `Requirements gathering started: ${unanswered.length} questions remaining`,
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        questions,
                        unansweredCount: unanswered.length,
                        answeredCount: questions.length - unanswered.length,
                        instruction: unanswered.length > 0
                            ? `Ask the user these ${unanswered.length} questions one at a time. After each answer, use update_project_context to store it. When all questions are answered, proceed with the pipeline.`
                            : 'All requirements gathered! Proceed with run_pipeline.',
                    }),
                }],
        };
    });
    // --- update_project_context ---
    server.tool('update_project_context', 'Update the project context with gathered requirements. Use this after asking the user questions via gather_requirements.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        name: z.string().optional().describe('Updated project name'),
        description: z.string().optional().describe('Updated project description'),
        requirements: z.array(z.string()).optional().describe('Updated or additional requirements'),
        techStack: z.array(z.string()).optional().describe('Technology stack choices'),
        constraints: z.array(z.string()).optional().describe('Project constraints'),
        targetUsers: z.string().optional().describe('Target user description'),
        deploymentTarget: z.string().optional().describe('Deployment target (web, CLI, mobile, etc.)'),
        existingIntegrations: z.string().optional().describe('Existing code/APIs to integrate'),
    }, async ({ workspacePath, ...updates }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        // Merge requirements arrays rather than replacing
        if (cleanUpdates.requirements) {
            const board = manager.readBoard();
            const existing = board.project.requirements ?? [];
            const newReqs = cleanUpdates.requirements;
            cleanUpdates.requirements = [...new Set([...existing, ...newReqs])];
        }
        manager.updateProjectContext(cleanUpdates);
        manager.logEvent({
            level: 'info',
            agent: 'product-manager',
            stage: 'spec',
            action: 'project_context_updated',
            message: `Project context updated: ${Object.keys(cleanUpdates).join(', ')}`,
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Project context updated with: ${Object.keys(cleanUpdates).join(', ')}`,
                        updatedFields: Object.keys(cleanUpdates),
                    }),
                }],
        };
    });
}
//# sourceMappingURL=init-project.js.map