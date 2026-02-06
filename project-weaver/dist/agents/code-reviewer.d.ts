import type { AgentRole } from '../types.js';
export declare const codeReviewerConfig: {
    role: AgentRole;
    displayName: string;
    defaultStages: readonly ["review"];
    outputTypes: readonly ["feedback", "decision", "handoff"];
    systemPrompt: string;
};
