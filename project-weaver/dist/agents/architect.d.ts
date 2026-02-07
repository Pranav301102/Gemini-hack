import type { AgentRole } from '../types.js';
export declare const architectConfig: {
    role: AgentRole;
    displayName: string;
    defaultStages: readonly ["read", "architecture"];
    outputTypes: readonly ["decision", "artifact", "handoff"];
    systemPrompt: string;
};
