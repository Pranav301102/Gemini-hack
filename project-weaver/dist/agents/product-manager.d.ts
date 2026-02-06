import type { AgentRole } from '../types.js';
export declare const productManagerConfig: {
    role: AgentRole;
    displayName: string;
    defaultStages: readonly ["spec", "stories"];
    outputTypes: readonly ["decision", "artifact", "handoff"];
    systemPrompt: string;
};
