import type { AgentRole } from '../types.js';
export declare const architectConfig: {
    role: AgentRole;
    displayName: string;
    phases: readonly ["read", "plan"];
    outputTypes: readonly ["brainstorm", "proposal", "decision", "artifact", "memory-map"];
    systemPrompt: string;
};
