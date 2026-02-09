import type { AgentRole } from '../types.js';
export declare const qaConfig: {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["artifact", "proposal", "decision"];
    systemPrompt: string;
};
