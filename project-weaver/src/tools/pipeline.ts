import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import {
  PipelineStage,
  PIPELINE_STAGES,
  STAGE_AGENT_MAP,
  STAGE_DESCRIPTIONS,
  AGENT_DISPLAY_NAMES,
} from '../types.js';

// Per-stage detailed instructions with multi-step refinement
const STAGE_INSTRUCTIONS: Record<PipelineStage, string[]> = {
  spec: [
    'Call assign_agent with agent="product-manager" and task="Analyze requirements and create a detailed specification"',
    'Read the roleContext returned and reason as the Product Manager',
    'If requirements are unclear, use gather_requirements to get structured questions, ask the user, and store answers via update_project_context',
    'DRAFT: Write the full specification following the PM output format (Project Summary, Core Features, NFRs, Out of Scope, Open Questions)',
    'SELF-REVIEW: Check that all acceptance criteria are testable and priorities are consistent',
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
    'Call update_context_board with type="handoff" to pass context to the Architect for the "architecture" stage',
  ],
  architecture: [
    'Call assign_agent with agent="architect" and task="Design system architecture, file structure, and technical decisions"',
    'Read the roleContext, spec, and user stories from previous stages',
    'DRAFT: Produce the full architecture document with ALL required sections (Overview, File Structure, Design Decisions, Data Models, API Contracts, Component Interaction, Dependencies)',
    'SELF-REVIEW: Verify the file structure accounts for every feature, diagrams match descriptions, and no circular dependencies exist',
    'REFINE: Fix any issues found in self-review',
    'Call update_context_board with type="artifact" to record the architecture',
    'Record each key design decision as a separate "decision" entry',
    'Create "diagram" widgets for architecture flowchart and sequence diagram',
    'Create a "table" widget for the file structure',
    'Call complete_agent_task for "architect"',
    'Call update_context_board with type="handoff" to pass the file structure and tech decisions to the Developer',
  ],
  implementation: [
    'Call assign_agent with agent="developer" and task="Write production code across all files"',
    'Read the roleContext, architecture, and file structure from previous stages',
    'PLAN: List all files to create in dependency order',
    'IMPLEMENT: For EACH file, use the save_file tool to write the complete file to disk. Never leave TODO placeholders.',
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
    'Call assign_agent with agent="code-reviewer" and task="Review code for bugs, security, and best practices"',
    'Read the roleContext, architecture decisions, implementation, and test results',
    'REVIEW: Evaluate ALL 6 checklist areas (Correctness, Architecture Alignment, Security, Performance, Code Quality, Test Coverage)',
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
    'Run the full AI Software Agency pipeline: spec -> stories -> architecture -> implementation -> testing -> review -> ship. Returns a structured execution plan for Gemini to follow step by step.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      startStage: z.enum(['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship']).optional().describe('Stage to start from (default: first incomplete stage)'),
      endStage: z.enum(['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship']).optional().describe('Stage to end at (default: ship)'),
    },
    async ({ workspacePath, startStage, endStage }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project first.' }),
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
        effectiveStart = effectiveStart ?? 'spec';
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
          agentDisplayName: AGENT_DISPLAY_NAMES[agent],
          task: STAGE_DESCRIPTIONS[stage],
          instructions: STAGE_INSTRUCTIONS[stage],
        };
      });

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
- For "implementation": Use save_file for EVERY code file. Write complete, working code.
- For "architecture": Include Mermaid diagrams in \`\`\`mermaid blocks. Follow the Mermaid rules in the Architect's prompt.
- For "testing": Use save_file for test files. Map every acceptance criterion to tests.
- For "review": Use request_revision if CHANGES REQUESTED. Max 2 revision cycles.
- Create structured widgets at each stage for the observability dashboard.
- This is NOT a simulation - produce real, working deliverables.`,
          }),
        }],
      };
    },
  );

  // --- advance_pipeline ---
  server.tool(
    'advance_pipeline',
    'Manually advance a pipeline stage to in-progress or complete.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      stage: z.enum(['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship']).describe('Stage to advance'),
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
