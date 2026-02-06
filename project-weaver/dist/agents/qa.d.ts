import type { AgentRole } from '../types.js';
export declare const qaConfig: {
    role: AgentRole;
    displayName: string;
    defaultStages: readonly ["testing"];
    outputTypes: readonly ["artifact", "feedback", "handoff"];
    systemPrompt: string;
};
