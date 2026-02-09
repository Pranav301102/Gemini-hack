import type { AgentRole } from '../types.js';
export declare const codeReviewerConfig: {
    role: AgentRole;
    displayName: string;
    phases: readonly ["ready"];
    outputTypes: readonly ["proposal", "decision"];
    systemPrompt: string;
};
