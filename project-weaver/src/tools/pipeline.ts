import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import {
  PipelineStage,
  PIPELINE_STAGES,
  STAGE_AGENT_MAP,
  STAGE_DESCRIPTIONS,
  AGENT_DISPLAY_NAMES,
  STAGE_NAMES,
  AgentRole,
} from '../types.js';

// Per-stage detailed instructions with multi-step refinement
const STAGE_INSTRUCTIONS: Record<PipelineStage, string[]> = {
  read: [
    'Call read_project with the workspace path to scan the existing codebase',
    'Review the detected tech stack, file counts, and project structure',
    'Call index_project to build the code index (function signatures, classes, imports, types)',
    'Call build_dependency_graph to compute file relationships, entry points, shared modules, and detect circular dependencies',
    'Call assign_agent with agent="architect" and task="Build agent memory by enriching code index with semantic descriptions"',
    'Call enrich_index to get a batch of un-enriched code items with code snippets',
    'For each item in the batch, write a concise one-line description of what it does and its purpose in the system',
    'Call save_enrichments with your descriptions to store them in the index',
    'Repeat: call enrich_index → write descriptions → save_enrichments until progress shows remaining=0',
    'Call get_dependency_graph with view="clusters" to review module boundaries and architectural patterns',
    'Call update_context_board with type="artifact" to record the codebase analysis — the enriched index IS the primary documentation',
    'Create a "table" widget for the file structure and a "kpi" widget for project stats',
    'Call complete_agent_task for "architect"',
    'Call update_context_board with type="handoff" to pass findings to the Architect for the "architecture" stage',
  ],
  architecture: [
    'Call assign_agent with agent="architect" and task="Design system architecture, file structure, coding style guide, and technical decisions"',
    'Read the roleContext and codebase analysis from the "read" stage',
    'If available, call get_project_index to understand existing code structure',
    'DRAFT: Produce the full architecture document with ALL required sections (Overview, File Structure, Design Decisions, Data Models, API Contracts, Component Interaction, Dependencies, Coding Style Guide)',
    'SELF-REVIEW: Verify the file structure accounts for every feature, diagrams match descriptions, no circular dependencies, and style guide is comprehensive',
    'REFINE: Fix any issues found in self-review',
    'Call update_context_board with type="artifact" to record the architecture',
    'Record the Coding Style Guide as a separate "decision" entry with metadata { isStyleGuide: true }',
    'Record each key design decision as a separate "decision" entry',
    'Create "diagram" widgets for architecture flowchart and sequence diagram',
    'Create a "table" widget for the file structure',
    'Call complete_agent_task for "architect"',
    'Call update_context_board with type="handoff" to pass architecture to the Product Manager for the "spec" stage',
  ],
  spec: [
    'Call assign_agent with agent="product-manager" and task="Analyze requirements and create a detailed specification aligned with architecture"',
    'Read the roleContext and the architecture document from the previous stage',
    'If requirements are unclear and this is NOT a read-mode project, use gather_requirements to get structured questions, ask the user, and store answers via update_project_context',
    'DRAFT: Write the full specification following the PM output format (Project Summary, Core Features, NFRs, Out of Scope, Open Questions). Align with the Architect\'s file structure and design decisions.',
    'SELF-REVIEW: Check that all acceptance criteria are testable and priorities are consistent with architecture',
    'REFINE: Fix any issues found in self-review',
    'Call update_context_board with type="artifact" to record the specification',
    'Create structured widgets: a "list" widget for requirements, a "kpi" widget for project metrics',
    'Call complete_agent_task for "product-manager"',
    'Call update_context_board with type="handoff" to pass context to the Product Manager for the "stories" stage',
  ],
  stories: [
    'Call assign_agent with agent="product-manager" and task="Break down the spec into user stories with acceptance criteria"',
    'Read the roleContext and the spec artifact from the previous stage',
    'DRAFT: Create user stories following the format: As a [user], I want [action] so that [benefit]',
    'SELF-REVIEW: Verify every feature from the spec has at least one story, and every story has testable acceptance criteria',
    'REFINE: Add missing stories or criteria found in self-review',
    'Call update_context_board with type="artifact" to record user stories',
    'Create a "table" widget for the story breakdown (Story, Priority, Complexity, Dependencies)',
    'Call complete_agent_task for "product-manager"',
    'Call update_context_board with type="handoff" to pass context to the approval stage',
  ],
  approval: [
    '⚠️ APPROVAL GATE: The pipeline pauses here for user review.',
    'Call check_approval to see if the user has already approved',
    'If approved: proceed to the next stage',
    'If not yet approved: Tell the user to review the architecture, spec, and stories on the dashboard, then approve or request changes',
    'Call get_approval_summary to show what needs review',
    'WAIT for user approval via the dashboard. Do NOT proceed until check_approval returns "approved".',
    'If changes-requested: The pipeline will automatically reset to architecture. Re-execute from there.',
  ],
  implementation: [
    'Call assign_agent with agent="developer" and task="Write production code following the style guide"',
    'Read the roleContext, architecture, file structure, and style guide from previous stages',
    'Use understand_file for each existing file you plan to modify — get full context (descriptions, deps, dependents) without reading source',
    'Use search_codebase to find existing utilities before writing new ones — avoid duplication',
    'Use get_dependency_graph with focus on your target directory to understand the impact of changes',
    'PLAN: List all files to create in dependency order',
    'IMPLEMENT: For EACH file, use the save_file tool to write the complete file to disk. Never leave TODO placeholders. Follow the Coding Style Guide exactly.',
    'SELF-REVIEW: Verify all files in the architecture exist, imports resolve, and entry point wires everything together',
    'REFINE: Fix any issues found in self-review using save_file to update files',
    'Call update_context_board with type="artifact" to record a summary of all files created',
    'Create a "table" widget listing files (File, Lines, Purpose) and a "kpi" widget with metrics',
    'Call complete_agent_task for "developer"',
    'Call update_context_board with type="handoff" to pass implementation details to QA for the "testing" stage',
  ],
  testing: [
    'Call assign_agent with agent="qa" and task="Write and run tests for the implementation"',
    'Read the roleContext, user stories (with acceptance criteria), and implementation artifacts',
    'Use understand_file for each implemented file to understand its functions, descriptions, and dependencies',
    'Use search_codebase to find all related functions and types that need testing',
    'Use get_dependency_graph to identify critical paths that need testing',
    'PLAN: Map every acceptance criterion (AC-X-Y) to test cases',
    'IMPLEMENT: For EACH test file, use save_file to write the test file to disk',
    'VERIFY: Check that every AC has at least one corresponding test',
    'Record bugs found as "feedback" entries with severity on the context board',
    'Call update_context_board with type="artifact" to record the test plan and results',
    'Create a "table" widget mapping AC to test results, a "kpi" widget with test metrics',
    'Call complete_agent_task for "qa"',
    'Call update_context_board with type="handoff" to pass test results to the Code Reviewer',
  ],
  review: [
    'Call assign_agent with agent="code-reviewer" and task="Review code for bugs, security, style guide compliance, and best practices"',
    'Read the roleContext, architecture decisions, implementation, test results, and style guide',
    'Use get_dependency_graph with view="circular" to check for any new circular dependencies introduced by the implementation',
    'Use understand_file for each file under review to understand its role, dependencies, and dependents before reading source',
    'Use search_codebase to verify that new code does not duplicate existing functionality',
    'REVIEW: Evaluate ALL 7 checklist areas (Correctness, Architecture Alignment, Security, Performance, Code Quality, Test Coverage, Style Guide Compliance)',
    'SELF-REVIEW: Ensure issues are categorized by severity and verdict is proportional',
    'Record review findings as a "feedback" entry on the context board',
    'If APPROVED: Record verdict as a "decision" entry, create review widgets, then handoff to Developer for "ship" stage',
    'If CHANGES REQUESTED: Use request_revision tool with specific feedback and affected files. This resets to implementation. Max 2 revision cycles.',
    'Call complete_agent_task for "code-reviewer"',
  ],
  ship: [
    'Call assign_agent with agent="developer" and task="Finalize and prepare the project for deployment"',
    'Read the roleContext and the Code Reviewer\'s approval',
    'Create any missing configuration files (package.json, README, .gitignore, etc.) using save_file',
    'Verify all files are saved and the project structure is complete',
    'Record a "decision" entry with the project completion summary',
    'Create a final "kpi" widget summarizing the project (total files, total LOC, features implemented, tests written)',
    'Call complete_agent_task for "developer"',
    'Log a final "pipeline_complete" event',
  ],
};

export function registerPipeline(server: McpServer): void {

  server.tool(
    'run_pipeline',
    'Run the full AI Software Agency pipeline: read -> architecture -> spec -> stories -> approval -> implementation -> testing -> review -> ship. Returns a structured execution plan for Gemini to follow step by step.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      startStage: z.enum(STAGE_NAMES).optional().describe('Stage to start from (default: first incomplete stage)'),
      endStage: z.enum(STAGE_NAMES).optional().describe('Stage to end at (default: ship)'),
    },
    async ({ workspacePath, startStage, endStage }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project or read_project first.' }),
          }],
        };
      }

      const board = manager.readBoard();

      // Determine start stage: either specified, or first non-complete stage
      let effectiveStart = startStage;
      if (!effectiveStart) {
        for (const stage of PIPELINE_STAGES) {
          if (board.pipeline.stages[stage].status !== 'complete') {
            effectiveStart = stage;
            break;
          }
        }
        effectiveStart = effectiveStart ?? 'read';
      }

      const startIdx = PIPELINE_STAGES.indexOf(effectiveStart);
      const endIdx = PIPELINE_STAGES.indexOf(endStage ?? 'ship');
      const activeStages = PIPELINE_STAGES.slice(startIdx, endIdx + 1);

      manager.logEvent({
        level: 'info',
        action: 'pipeline_started',
        message: `Pipeline started: ${activeStages[0]} -> ${activeStages[activeStages.length - 1]}`,
        data: { stages: activeStages },
      });

      // Build execution plan with detailed per-stage instructions
      const plan = activeStages.map((stage: PipelineStage, index: number) => {
        const agent = STAGE_AGENT_MAP[stage];
        return {
          step: index + 1,
          stage,
          agent,
          agentDisplayName: agent === 'user' ? 'User (Approval Gate)' : AGENT_DISPLAY_NAMES[agent as AgentRole],
          task: STAGE_DESCRIPTIONS[stage],
          instructions: STAGE_INSTRUCTIONS[stage],
        };
      });

      // Check if approval gate is in the plan
      const hasApproval = activeStages.includes('approval');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Pipeline plan created with ${plan.length} stages. Execute each step sequentially.`,
            project: board.project,
            plan,
            instruction: `Execute each step in order. For EACH step, follow the detailed instructions provided.

## Multi-Step Refinement Pattern
Each agent follows a DRAFT → SELF-REVIEW → REFINE cycle:
1. **DRAFT**: Produce initial output following the agent's format
2. **SELF-REVIEW**: Review your own output against the requirements
3. **REFINE**: Improve based on self-review findings
4. **RECORD**: Post final output to the context board

## Key Rules
- Architect goes FIRST: designs architecture + style guide before PM writes spec
- PM aligns spec with architecture (not the other way around)
- For "implementation": Use save_file for EVERY code file. Write complete, working code. Follow the Coding Style Guide.
- For "architecture": Include Mermaid diagrams. Include a Coding Style Guide section.
- For "testing": Use save_file for test files. Map every acceptance criterion to tests.
- For "review": Check style guide compliance. Use request_revision if CHANGES REQUESTED. Max 2 revision cycles.
- Create structured widgets at each stage for the observability dashboard.
- This is NOT a simulation - produce real, working deliverables.
${hasApproval ? '\n## ⚠️ APPROVAL GATE\nThe pipeline will PAUSE at the "approval" stage. The user must review and approve from the dashboard before implementation begins. Do NOT skip this step.' : ''}`,
          }),
        }],
      };
    },
  );

  server.tool(
    'advance_pipeline',
    'Manually advance a pipeline stage to in-progress or complete.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      stage: z.enum(STAGE_NAMES).describe('Stage to advance'),
      status: z.enum(['in-progress', 'complete']).describe('New status for the stage'),
    },
    async ({ workspacePath, stage, status }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const agent = STAGE_AGENT_MAP[stage];
      manager.advanceStage(stage, status, agent);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Stage "${stage}" is now ${status}`,
          }),
        }],
      };
    },
  );
}
