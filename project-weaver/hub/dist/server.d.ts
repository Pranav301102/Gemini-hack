/**
 * Weaver Hub — Central Sync Server
 *
 * Stores .weaver project intelligence snapshots keyed by:
 *   repo (git remote URL) + branch
 *
 * Teams push/pull .weaver state so everyone shares the same
 * code index, plan, annotations, and agent memory.
 *
 * Storage: ~/.weaver-hub/<repo-hash>/<branch>/
 *   context.json, index.json, plan.json, code-maps.json,
 *   docs.json, team.json, annotations.json, meta.json
 */
export {};
