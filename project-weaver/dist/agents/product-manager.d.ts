import type { AgentRole } from '../types.js';
export declare const productManagerConfig: {
    role: AgentRole;
    displayName: string;
    phases: readonly ["plan"];
    outputTypes: readonly ["brainstorm", "proposal", "decision", "artifact", "memory-map"];
    systemPrompt: string;
};
