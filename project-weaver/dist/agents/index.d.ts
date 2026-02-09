import type { AgentRole, ContextEntry, ProjectContext } from '../types.js';
/**
 * Build a full prompt for an agent, incorporating:
 * - Their role-specific system prompt
 * - Project context (name, description, requirements, tech stack)
 * - Recent context board entries from other agents
 * - Any additional context passed by the orchestrator
 */
export declare function getAgentPrompt(role: AgentRole, project: ProjectContext, recentEntries: ContextEntry[], additionalContext?: string): string;
/** Get just the system prompt for an agent (no project context) */
export declare function getAgentSystemPrompt(role: AgentRole): string;
/** Get agent config */
export declare function getAgentConfig(role: AgentRole): {
    role: AgentRole;
    displayName: string;
    phases: readonly ["plan"];
    outputTypes: readonly ["brainstorm", "proposal", "decision", "artifact", "memory-map"];
    systemPrompt: string;
} | {
    role: AgentRole;
    displayName: string;
    phases: readonly ["read", "plan"];
    outputTypes: readonly ["brainstorm", "proposal", "decision", "artifact", "memory-map"];
    systemPrompt: string;
} | {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["artifact", "question", "decision"];
    systemPrompt: string;
} | {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["artifact", "proposal", "decision"];
    systemPrompt: string;
} | {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["proposal", "decision"];
    systemPrompt: string;
};
