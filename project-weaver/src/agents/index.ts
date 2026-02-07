import type { AgentRole, ContextEntry, ProjectContext } from '../types.js';
import { AGENT_DISPLAY_NAMES } from '../types.js';
import { productManagerConfig } from './product-manager.js';
import { architectConfig } from './architect.js';
import { developerConfig } from './developer.js';
import { qaConfig } from './qa.js';
import { codeReviewerConfig } from './code-reviewer.js';

const AGENT_CONFIGS = {
  'product-manager': productManagerConfig,
  'architect': architectConfig,
  'developer': developerConfig,
  'qa': qaConfig,
  'code-reviewer': codeReviewerConfig,
} as const;

/**
 * Build a full prompt for an agent, incorporating:
 * - Their role-specific system prompt
 * - Project context (name, description, requirements, tech stack)
 * - Recent context board entries from other agents
 * - Any additional context passed by the orchestrator
 */
export function getAgentPrompt(
  role: AgentRole,
  project: ProjectContext,
  recentEntries: ContextEntry[],
  additionalContext?: string,
): string {
  const config = AGENT_CONFIGS[role];

  const projectSummary = [
    `**Project:** ${project.name}`,
    `**Description:** ${project.description}`,
    project.targetUsers
      ? `**Target Users:** ${project.targetUsers}`
      : null,
    project.deploymentTarget
      ? `**Deployment Target:** ${project.deploymentTarget}`
      : null,
    project.requirements.length > 0
      ? `**Requirements:**\n${project.requirements.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`
      : null,
    project.techStack && project.techStack.length > 0
      ? `**Tech Stack:** ${project.techStack.join(', ')}`
      : null,
    project.constraints && project.constraints.length > 0
      ? `**Constraints:** ${project.constraints.join(', ')}`
      : null,
    project.existingIntegrations
      ? `**Existing Integrations:** ${project.existingIntegrations}`
      : null,
  ].filter(Boolean).join('\n');

  // Group entries by type for better context
  const artifacts = recentEntries.filter(e => e.type === 'artifact');
  const decisions = recentEntries.filter(e => e.type === 'decision');
  const feedback = recentEntries.filter(e => e.type === 'feedback');
  const handoffs = recentEntries.filter(e => e.type === 'handoff');

  let recentWork = '';
  if (recentEntries.length > 0) {
    const formatEntries = (entries: ContextEntry[], limit: number) =>
      entries.slice(-limit).map(e => {
        const preview = e.content.length > 500 ? e.content.substring(0, 500) + '...' : e.content;
        return `- [${AGENT_DISPLAY_NAMES[e.agent]} / ${e.stage}] **${e.title}**\n  ${preview}`;
      }).join('\n\n');

    recentWork = '\n**Context Board Summary:**\n';

    if (handoffs.length > 0) {
      recentWork += `\n### Handoffs (most relevant to you):\n${formatEntries(handoffs, 3)}\n`;
    }
    if (artifacts.length > 0) {
      recentWork += `\n### Agent Artifacts:\n${formatEntries(artifacts, 5)}\n`;
    }
    if (decisions.length > 0) {
      recentWork += `\n### Decisions Made:\n${formatEntries(decisions, 5)}\n`;
    }
    if (feedback.length > 0) {
      recentWork += `\n### Feedback & Issues:\n${formatEntries(feedback, 3)}\n`;
    }
  }

  // Inject style guide prominently for Developer and Code Reviewer
  let styleGuideSection = '';
  if (role === 'developer' || role === 'code-reviewer') {
    const styleGuideEntry = recentEntries.find(
      e => e.type === 'decision' && e.metadata?.isStyleGuide === true,
    );
    if (styleGuideEntry) {
      styleGuideSection = `\n---\n\n## 🎨 Coding Style Guide (from Architect)\n\n${styleGuideEntry.content}\n`;
    }
  }

  const parts = [
    config.systemPrompt,
    '\n---\n',
    '## Project Context\n',
    projectSummary,
    styleGuideSection,
    recentWork,
  ];

  if (additionalContext) {
    parts.push(`\n---\n\n## Additional Context\n\n${additionalContext}`);
  }

  return parts.join('\n');
}

/** Get just the system prompt for an agent (no project context) */
export function getAgentSystemPrompt(role: AgentRole): string {
  return AGENT_CONFIGS[role].systemPrompt;
}

/** Get agent config */
export function getAgentConfig(role: AgentRole) {
  return AGENT_CONFIGS[role];
}
