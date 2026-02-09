import type { AgentRole } from '../types.js';
export declare const developerConfig: {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["artifact", "question", "decision"];
    systemPrompt: string;
};
