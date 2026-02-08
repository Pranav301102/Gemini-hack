import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { AGENT_DISPLAY_NAMES } from '../types.js';
const agentEnum = z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']);
const changeTypeEnum = z.enum(['create', 'modify', 'refactor', 'delete', 'extend']);
const priorityEnum = z.enum(['must-have', 'should-have', 'nice-to-have']);
const complexityEnum = z.enum(['trivial', 'small', 'medium', 'large', 'epic']);
const brainstormTypeEnum = z.enum(['observation', 'proposal', 'question', 'agreement', 'counter-proposal', 'decision']);
export function registerPlanner(server) {
    // --- run_plan ---
    server.tool('run_plan', 'Start the planning phase. Assembles context from the project index and returns structured instructions for the Architect + PM brainstorm collaboration.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project or read_project first.' }),
                    }],
            };
        }
        const board = manager.readBoard();
        const index = manager.readIndex();
        // Check if project has been indexed
        const isExistingProject = !!index && index.files.length > 0;
        // Update project context
        manager.updateProjectContext({ isExistingProject });
        manager.setPhase('plan');
        // Build context summary from index
        let indexSummary = '';
        if (index) {
            const enrichedCount = index.enrichmentProgress?.enrichedItems ?? 0;
            const totalItems = index.enrichmentProgress?.totalItems ?? 0;
            indexSummary = `
## Project Index Summary
- **Tech Stack:** ${index.techStack.join(', ')}
- **Total Files:** ${index.totalFiles}
- **Total Functions:** ${index.totalFunctions}
- **Total Classes:** ${index.totalClasses}
- **Total Types:** ${index.totalTypes}
- **Enrichment Progress:** ${enrichedCount}/${totalItems} items enriched

### Key Files (by import count):
${(index.dependencyGraph?.sharedModules ?? []).slice(0, 10).map(m => `- \`${m.file}\` (imported by ${m.importedBy} files)`).join('\n')}

### Entry Points:
${(index.dependencyGraph?.entryPoints ?? []).slice(0, 10).map(e => `- \`${e}\``).join('\n')}

### Module Clusters:
${(index.dependencyGraph?.clusters ?? []).slice(0, 8).map(c => `- \`${c.directory}/\` — ${c.files.length} files, ${c.internalEdges} internal / ${c.externalEdges} external edges`).join('\n')}

${(index.dependencyGraph?.circularDeps ?? []).length > 0 ? `### Circular Dependencies (issues):\n${index.dependencyGraph.circularDeps.map(cycle => `- ${cycle.join(' → ')}`).join('\n')}` : ''}`;
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        isExistingProject,
                        project: board.project,
                        indexSummary,
                        instruction: isExistingProject
                            ? `## Brainstorm Instructions

You have access to an indexed codebase. Follow this flow:

### Step 1: Architect Analysis
1. Call \`assign_agent\` with agent="architect" and task="Analyze codebase and identify improvement opportunities"
2. As the Architect, review the index summary above
3. Use \`understand_file\` on the key shared modules and entry points to understand the system
4. Use \`get_dependency_graph\` with view="clusters" to understand module boundaries
5. Call \`add_brainstorm_entry\` with type="observation" to share your architectural analysis
6. Call \`add_brainstorm_entry\` with type="proposal" for each improvement area you identify

### Step 2: PM Analysis
1. Call \`assign_agent\` with agent="product-manager" and task="Identify product improvements from user perspective"
2. As the PM, review the codebase from a product/user perspective
3. Use \`search_codebase\` to find user-facing features and interactions
4. Call \`add_brainstorm_entry\` with type="observation" to share product insights
5. Call \`add_brainstorm_entry\` with type="proposal" for user-facing improvements

### Step 3: Collaborative Planning
1. Build on each other's proposals — Architect evaluates PM's suggestions technically, PM evaluates Architect's for user impact
2. For each agreed change, call \`add_proposed_change\` with full details
3. Group related changes into logical groups (e.g., "Performance", "UX", "Security")
4. Call \`add_brainstorm_entry\` with type="decision" for finalized decisions

### Step 4: Finalize Plan
1. Call \`save_plan\` with the complete plan summary, goals, approach, and risk assessment
2. Create dashboard widgets:
   - A "diagram" widget with current architecture (Mermaid)
   - A "diagram" widget with proposed changes (Mermaid)
   - A "table" widget for the file change map
   - A "kpi" widget with plan metrics
3. Tell the user: "Plan created. Run /dashboard to view it."

IMPORTANT: Do NOT ask the user requirements questions. Use the indexed project data directly.`
                            : `## New Project Instructions

This is a new project without an existing codebase.

### Step 1: Gather Requirements
1. Call \`gather_requirements\` to get structured questions
2. Ask the user each unanswered question
3. Store answers using \`update_project_context\`

### Step 2: Collaborative Planning
Follow Steps 1-4 from the existing project flow above, but base proposals on the gathered requirements instead of an index.`,
                    }),
                }],
        };
    });
    // --- add_proposed_change ---
    server.tool('add_proposed_change', 'Add a proposed change to the plan. Groups changes into logical ChangeGroups. Creates a new group if the groupId does not exist.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        groupId: z.string().describe('ID for the change group (use a slug like "auth-system" or "api-refactor")'),
        groupName: z.string().describe('Human-readable name for the change group'),
        groupDescription: z.string().describe('Brief description of this change group'),
        agent: agentEnum.describe('Which agent is proposing this change'),
        changeId: z.string().describe('Unique ID for this change (use a slug like "add-auth-middleware")'),
        file: z.string().describe('Relative file path affected (or "NEW: path" for new files)'),
        changeType: changeTypeEnum.describe('Type of change'),
        title: z.string().describe('Concise title for this change'),
        description: z.string().describe('Detailed description of what changes'),
        rationale: z.string().describe('Why this change is needed'),
        priority: priorityEnum.describe('Priority level'),
        complexity: complexityEnum.describe('Complexity estimate'),
        affectedFunctions: z.array(z.string()).optional().describe('Function names affected'),
        affectedClasses: z.array(z.string()).optional().describe('Class names affected'),
        affectedTypes: z.array(z.string()).optional().describe('Type names affected'),
        dependencies: z.array(z.string()).optional().describe('IDs of other changes this depends on'),
        codeSnippet: z.string().optional().describe('Optional code example'),
    }, async ({ workspacePath, groupId, groupName, groupDescription, agent, changeId, file, changeType, title, description, rationale, priority, complexity, affectedFunctions, affectedClasses, affectedTypes, dependencies, codeSnippet }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        manager.addProposedChange(groupId, groupName, groupDescription, agent, {
            id: changeId,
            file,
            changeType,
            title,
            description,
            rationale,
            priority,
            complexity,
            affectedFunctions,
            affectedClasses,
            affectedTypes,
            dependencies: dependencies ?? [],
            codeSnippet,
        });
        manager.logEvent({
            level: 'info',
            agent,
            phase: 'plan',
            action: 'change_proposed',
            message: `${AGENT_DISPLAY_NAMES[agent]} proposed: ${title} (${changeType} ${file})`,
            data: { changeId, groupId, priority, complexity },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Change "${title}" added to group "${groupName}"`,
                        changeId,
                        groupId,
                    }),
                }],
        };
    });
    // --- add_brainstorm_entry ---
    server.tool('add_brainstorm_entry', 'Record a brainstorm discussion entry between agents. Used to log observations, proposals, questions, agreements, and decisions during the planning phase.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        agent: agentEnum.describe('Which agent is speaking'),
        type: brainstormTypeEnum.describe('Type of brainstorm entry'),
        content: z.string().describe('The brainstorm content'),
        referencedFiles: z.array(z.string()).optional().describe('File paths referenced in this entry'),
        referencedChanges: z.array(z.string()).optional().describe('Change IDs referenced'),
    }, async ({ workspacePath, agent, type, content, referencedFiles, referencedChanges }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const entry = manager.addBrainstormEntry({ agent, type, content, referencedFiles, referencedChanges });
        manager.logEvent({
            level: 'info',
            agent,
            phase: 'plan',
            action: `brainstorm_${type}`,
            message: `${AGENT_DISPLAY_NAMES[agent]} [${type}]: ${content.substring(0, 100)}`,
            data: { entryId: entry.id },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Brainstorm entry recorded: ${type}`,
                        entryId: entry.id,
                    }),
                }],
        };
    });
    // --- save_plan ---
    server.tool('save_plan', 'Finalize and save the project plan. Updates the plan with summary, goals, approach, risk assessment, file map, and diagrams. Sets the project phase to "ready".', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        summary: z.string().describe('Executive summary of the plan'),
        goals: z.array(z.string()).describe('What the plan achieves'),
        approach: z.string().describe('High-level technical approach'),
        architectureNotes: z.string().optional().describe('Architecture analysis notes'),
        riskAssessment: z.string().optional().describe('Risks and mitigations'),
        diagrams: z.array(z.object({
            id: z.string(),
            title: z.string(),
            type: z.enum(['current-architecture', 'proposed-architecture', 'change-impact', 'dependency-flow']),
            mermaidCode: z.string(),
        })).optional().describe('Mermaid diagrams for the plan'),
    }, async ({ workspacePath, summary, goals, approach, architectureNotes, riskAssessment, diagrams }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const index = manager.readIndex();
        // Build the plan from accumulated data
        const existingPlan = board.plan;
        const changeGroups = existingPlan?.changeGroups ?? [];
        const discussion = existingPlan?.discussion ?? [];
        // Build file change map from proposed changes
        const fileChanges = new Map();
        for (const group of changeGroups) {
            for (const change of group.changes) {
                const existing = fileChanges.get(change.file) ?? [];
                existing.push({ changeId: change.id, changeType: change.changeType, summary: change.title });
                fileChanges.set(change.file, existing);
            }
        }
        // Build FileChangeMap array
        const fileMap = Array.from(fileChanges.entries()).map(([file, changes]) => {
            const indexFile = index?.files.find(f => f.path === file);
            const priorities = changes.map(c => {
                const change = changeGroups.flatMap(g => g.changes).find(ch => ch.id === c.changeId);
                return change?.priority ?? 'nice-to-have';
            });
            const priorityOrder = { 'must-have': 0, 'should-have': 1, 'nice-to-have': 2 };
            const maxPriority = priorities.sort((a, b) => (priorityOrder[a] ?? 2) - (priorityOrder[b] ?? 2))[0] ?? 'nice-to-have';
            return {
                file,
                exists: !!indexFile || !file.startsWith('NEW:'),
                language: indexFile?.language ?? 'unknown',
                currentDescription: indexFile?.enrichedDescription,
                changes: changes,
                totalChanges: changes.length,
                maxPriority: maxPriority,
            };
        });
        const plan = {
            id: existingPlan?.id ?? manager['generateId'](),
            version: '1.0.0',
            createdAt: existingPlan?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            summary,
            goals,
            approach,
            changeGroups,
            architectureNotes: architectureNotes ?? existingPlan?.architectureNotes ?? '',
            riskAssessment: riskAssessment ?? existingPlan?.riskAssessment ?? '',
            fileMap,
            discussion,
            diagrams: diagrams ?? existingPlan?.diagrams ?? [],
        };
        manager.writePlan(plan);
        const totalChanges = changeGroups.reduce((sum, g) => sum + g.changes.length, 0);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Plan saved with ${changeGroups.length} groups, ${totalChanges} changes, ${fileMap.length} files affected`,
                        planId: plan.id,
                        stats: {
                            changeGroups: changeGroups.length,
                            totalChanges,
                            filesAffected: fileMap.length,
                            discussionEntries: discussion.length,
                            diagrams: (diagrams ?? []).length,
                        },
                    }),
                }],
        };
    });
    // --- get_plan ---
    server.tool('get_plan', 'Read the current project plan. Supports different views: summary, full, file-map, changes, discussion.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        view: z.enum(['summary', 'full', 'file-map', 'changes', 'discussion']).optional().describe('Which view of the plan to return (default: summary)'),
    }, async ({ workspacePath, view }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const plan = manager.readPlan();
        if (!plan) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: 'No plan exists yet. Run run_plan first.' }),
                    }],
            };
        }
        const effectiveView = view ?? 'summary';
        let response;
        switch (effectiveView) {
            case 'summary':
                response = {
                    success: true,
                    summary: plan.summary,
                    goals: plan.goals,
                    approach: plan.approach,
                    stats: {
                        changeGroups: plan.changeGroups.length,
                        totalChanges: plan.changeGroups.reduce((sum, g) => sum + g.changes.length, 0),
                        filesAffected: plan.fileMap.length,
                        diagrams: plan.diagrams.length,
                    },
                    groups: plan.changeGroups.map(g => ({
                        id: g.id,
                        name: g.name,
                        agent: g.agent,
                        changeCount: g.changes.length,
                    })),
                };
                break;
            case 'full':
                response = { success: true, plan };
                break;
            case 'file-map':
                response = { success: true, fileMap: plan.fileMap };
                break;
            case 'changes':
                response = { success: true, changeGroups: plan.changeGroups };
                break;
            case 'discussion':
                response = { success: true, discussion: plan.discussion };
                break;
            default:
                response = { success: true, plan };
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response),
                }],
        };
    });
    // --- get_file_change_map ---
    server.tool('get_file_change_map', 'Get all proposed changes for a specific file. Shows what will change in that file and why.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        filePath: z.string().describe('Relative file path to look up'),
    }, async ({ workspacePath, filePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const plan = manager.readPlan();
        if (!plan) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: 'No plan exists yet.' }),
                    }],
            };
        }
        // Find all changes for this file
        const fileMapEntry = plan.fileMap.find(f => f.file === filePath);
        const detailedChanges = plan.changeGroups.flatMap(g => g.changes.filter(c => c.file === filePath).map(c => ({
            ...c,
            group: g.name,
            groupId: g.id,
        })));
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        file: filePath,
                        fileMap: fileMapEntry ?? null,
                        changes: detailedChanges,
                        totalChanges: detailedChanges.length,
                    }),
                }],
        };
    });
}
//# sourceMappingURL=planner.js.map