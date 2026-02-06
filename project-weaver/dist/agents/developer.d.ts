import type { AgentRole } from '../types.js';
export declare const developerConfig: {
    role: AgentRole;
    displayName: string;
    defaultStages: readonly ["implementation", "ship"];
    outputTypes: readonly ["artifact", "question", "handoff"];
    systemPrompt: string;
};
