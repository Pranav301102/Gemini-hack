// All agent roles as array for iteration
export const AGENT_ROLES = ['product-manager', 'architect', 'developer', 'qa', 'code-reviewer'];
// All pipeline stages in order
export const PIPELINE_STAGES = ['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship'];
// Maps pipeline stages to responsible agents
export const STAGE_AGENT_MAP = {
    'spec': 'product-manager',
    'stories': 'product-manager',
    'architecture': 'architect',
    'implementation': 'developer',
    'testing': 'qa',
    'review': 'code-reviewer',
    'ship': 'developer',
};
// Human-readable stage descriptions
export const STAGE_DESCRIPTIONS = {
    'spec': 'Analyze requirements and create a detailed specification',
    'stories': 'Break down the spec into user stories with acceptance criteria',
    'architecture': 'Design system architecture, file structure, and technical decisions',
    'implementation': 'Write production code across all files',
    'testing': 'Write and run tests for the implementation',
    'review': 'Review code for bugs, security, and best practices',
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