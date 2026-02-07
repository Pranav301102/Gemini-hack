// Shared Zod-compatible stage names array (use in z.enum() calls)
export const STAGE_NAMES = ['read', 'architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship'];
// All agent roles as array for iteration
export const AGENT_ROLES = ['product-manager', 'architect', 'developer', 'qa', 'code-reviewer'];
// All pipeline stages in order
export const PIPELINE_STAGES = ['read', 'architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship'];
// Maps pipeline stages to responsible agents (approval is user-driven)
export const STAGE_AGENT_MAP = {
    'read': 'architect',
    'architecture': 'architect',
    'spec': 'product-manager',
    'stories': 'product-manager',
    'approval': 'user',
    'implementation': 'developer',
    'testing': 'qa',
    'review': 'code-reviewer',
    'ship': 'developer',
};
// Human-readable stage descriptions
export const STAGE_DESCRIPTIONS = {
    'read': 'Scan existing codebase and auto-detect project structure, tech stack, and patterns',
    'architecture': 'Design system architecture, file structure, coding style guide, and technical decisions',
    'spec': 'Analyze requirements and create a detailed specification aligned with architecture',
    'stories': 'Break down the spec into user stories with acceptance criteria',
    'approval': 'User reviews architect design and PM spec, then approves or requests changes',
    'implementation': 'Write production code following the style guide',
    'testing': 'Write and run tests for the implementation',
    'review': 'Review code for bugs, security, style guide compliance, and best practices',
    'ship': 'Finalize and prepare the project for deployment',
};
// Agent display names
export const AGENT_DISPLAY_NAMES = {
    'product-manager': 'Product Manager',
    'architect': 'Architect',
    'developer': 'Developer',
    'qa': 'QA Engineer',
    'code-reviewer': 'Code Reviewer',
};
//# sourceMappingURL=types.js.map