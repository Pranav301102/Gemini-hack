// All agent roles as array for iteration
export const AGENT_ROLES = ['product-manager', 'architect', 'developer', 'qa', 'code-reviewer'];
// Project phases in order
export const PROJECT_PHASES = ['read', 'plan', 'ready'];
// Phase descriptions
export const PHASE_DESCRIPTIONS = {
    'read': 'Scan existing codebase and auto-detect project structure, tech stack, and patterns',
    'plan': 'Architect + PM brainstorm and create a plan with memory maps',
    'ready': 'Plan complete — ready for implementation',
};
// Agent display names
export const AGENT_DISPLAY_NAMES = {
    'product-manager': 'Product Manager',
    'architect': 'Architect',
    'developer': 'Developer',
    'qa': 'QA Engineer',
    'code-reviewer': 'Code Reviewer',
};
export const DOC_CATEGORIES = ['api', 'architecture', 'setup', 'feature', 'decision', 'runbook', 'changelog'];
export const DOC_CATEGORY_LABELS = {
    api: 'API Documentation',
    architecture: 'Architecture',
    setup: 'Setup & Onboarding',
    feature: 'Feature Specs',
    decision: 'Decisions',
    runbook: 'Runbooks',
    changelog: 'Changelog',
};
//# sourceMappingURL=types.js.map