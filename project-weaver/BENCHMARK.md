# 🧪 Project Weaver — Benchmark Roadmap

A hands-on test plan to verify every major feature works end-to-end.

> **Test project:** Use `/Users/spartan/Projects/Gemini-hack/test-weaver-project` or create any small project (a Todo app, REST API, etc.)

---

## Pre-Flight Checklist

Before running benchmarks, verify the build is clean:

```bash
# 1. Build the MCP server
cd project-weaver && npm run build
# ✅ Expected: compiles with no errors

# 2. Build the dashboard
cd dashboard && npm run build
# ✅ Expected: "Compiled successfully", all routes listed

# 3. Verify Gemini CLI picks up the extension
cd ~/any-project
gemini
# ✅ Expected: Gemini CLI starts, /read /build etc. are available as commands
```

---

## Benchmark 1: Code Intelligence Pipeline (`/read`)

**What it tests:** Project scanning → AST indexing → dependency graph → code maps → enrichment

### Steps
1. Open a terminal in any existing codebase (Node.js/TypeScript project works best)
2. Run `gemini` then type `/read`

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 1.1 | `.weaver/` directory created | `ls -la .weaver/` — should see `context.json` | ☐ |
| 1.2 | Project detected | Context board shows project name, tech stack, file count | ☐ |
| 1.3 | Code index built | `.weaver/index.json` exists and has `functions`, `classes`, `types` | ☐ |
| 1.4 | Dependency graph computed | `.weaver/index.json` has `dependencyGraph` with edges, entry points | ☐ |
| 1.5 | Code maps generated | `.weaver/code-maps.json` exists with `classMap`, `moduleMap`, `callGraph` | ☐ |
| 1.6 | Enrichment offered | Agent mentions enrichment or starts enriching index items | ☐ |
| 1.7 | Context board updated | Run `get_context_board` — shows architect entries with observations | ☐ |

### What Proves It's Working
- Open `index.json` — you should see every function with params, return types, JSDoc
- The dependency graph should show which files import which
- Code maps should have class hierarchies and module layers

---

## Benchmark 2: Planning Phase (`/build`)

**What it tests:** Architect + PM brainstorming → structured plan with change groups

### Steps
1. After `/read`, type `/build`
2. Describe what you want to build (e.g., "Add user authentication with JWT tokens")

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 2.1 | Architect assigned | Agent status shows architect = "working" | ☐ |
| 2.2 | PM assigned | Agent status shows product-manager = "working" | ☐ |
| 2.3 | Brainstorm entries created | Context board has entries of type "brainstorm" | ☐ |
| 2.4 | Change groups defined | Plan has logical groups (e.g., "Auth Module", "Database Schema") | ☐ |
| 2.5 | File map generated | Plan shows which files will be created/modified | ☐ |
| 2.6 | Plan saved | `.weaver/plan.json` exists with summary, goals, changeGroups | ☐ |
| 2.7 | Requirements have ACs | User stories include acceptance criteria (AC-X-Y format) | ☐ |

### What Proves It's Working
- `plan.json` should have `changeGroups[]` where each group has `changes[]` with file paths
- The `fileMap` should list every affected file with change types (create/modify/refactor)
- Brainstorm discussion should show architect and PM trading observations/proposals

---

## Benchmark 3: Implementation (`/implement`)

**What it tests:** Developer agent writes code following the plan and style guide

### Steps
1. After `/build`, type `/implement`
2. Let the developer work through the change groups

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 3.1 | Developer assigned | Agent status shows developer = "working" | ☐ |
| 3.2 | Files created | New files appear in the project directory | ☐ |
| 3.3 | Files tracked | `list_project_files` shows all created files with sizes | ☐ |
| 3.4 | Style guide followed | Code matches the architect's style guide (naming, patterns) | ☐ |
| 3.5 | No TODOs/placeholders | Grep for TODO in created files — should be zero | ☐ |
| 3.6 | Context board artifacts | Entries of type "artifact" for each file written | ☐ |
| 3.7 | Dependencies ordered | Files written in dependency order (shared modules first) | ☐ |

### What Proves It's Working
- Actual working code files on disk, not just descriptions
- Each file should be tracked in `context.json` under `files[]`
- The developer should reference the plan's change groups

---

## Benchmark 4: Testing (`/test`)

**What it tests:** QA agent writes tests → runs them → reports results

### Steps
1. After `/implement`, type `/test`

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 4.1 | QA assigned | Agent status shows qa = "working" | ☐ |
| 4.2 | Test files created | Test files appear (`.test.ts`, `.spec.ts`, etc.) | ☐ |
| 4.3 | Tests actually run | `run_command` was called with test runner (jest, vitest, etc.) | ☐ |
| 4.4 | Results reported | Context board has "proposal" entries with test results | ☐ |
| 4.5 | ACs mapped | Tests reference acceptance criteria (AC-X-Y) from the PM's spec | ☐ |
| 4.6 | Bugs filed | Any failures documented with severity | ☐ |

### What Proves It's Working
- Test files exist on disk and are syntactically valid
- Test execution output captured (pass/fail counts)
- Each acceptance criterion has at least one test

---

## Benchmark 5: Code Review (`/review`)

**What it tests:** Code Reviewer evaluates implementation → approves or requests revisions

### Steps
1. After `/test`, type `/review`

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 5.1 | Reviewer assigned | Agent status shows code-reviewer = "working" | ☐ |
| 5.2 | 7-area review | Review covers: correctness, architecture, security, performance, quality, tests, style | ☐ |
| 5.3 | Code maps used | Reviewer references class hierarchy or call graph | ☐ |
| 5.4 | Verdict given | Context board has "decision" entry with APPROVED or CHANGES REQUESTED | ☐ |
| 5.5 | Revision loop | If changes requested, developer is reassigned (check `request_revision`) | ☐ |

---

## Benchmark 6: Dashboard (`/dashboard`)

**What it tests:** Real-time observability dashboard shows all agent activity

### Steps
1. Run the dashboard: `cd dashboard && npm run dev`
2. Open `http://localhost:3000`
3. Enter the project path in the top bar
4. Run any `/command` in Gemini CLI and watch the dashboard update

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 6.1 | Dashboard loads | Page renders with 3-panel layout | ☐ |
| 6.2 | Project detected | Left panel shows project name, tech stack | ☐ |
| 6.3 | All 5 agents shown | Left panel lists PM, Architect, Developer, QA, Code Reviewer | ☐ |
| 6.4 | SSE connected | Green dot / "connected" indicator in the activity feed | ☐ |
| 6.5 | Context Board tab | Center panel shows all context entries with agent badges | ☐ |
| 6.6 | Code Intel tab | Shows class maps, module architecture, call graphs | ☐ |
| 6.7 | Plan tab | Shows change groups, file map, brainstorm discussion | ☐ |
| 6.8 | Docs tab | Shows documentation entries (after `/docs` is run) | ☐ |
| 6.9 | Real-time updates | Agent status changes appear without page refresh | ☐ |
| 6.10 | Activity feed | Right panel streams events as they happen | ☐ |

---

## Benchmark 7: Shared Memory & Docs

**What it tests:** Agents share context without re-reading code

### Steps
1. After running `/read` and `/build`, check that:

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 7.1 | Architect writes, PM reads | PM's spec references architecture decisions from context board | ☐ |
| 7.2 | Developer reads style guide | Developer mentions or follows coding patterns from architect | ☐ |
| 7.3 | QA reads PM's ACs | Test cases map directly to acceptance criteria IDs | ☐ |
| 7.4 | Reviewer reads code maps | Review references dependency graph or class hierarchy | ☐ |
| 7.5 | `/docs` creates docs | `.weaver/docs.json` populated with categories | ☐ |
| 7.6 | Docs queryable | `get_docs` returns docs filtered by category or tag | ☐ |
| 7.7 | Index is enriched | `index.json` items have `description` fields added by LLM | ☐ |
| 7.8 | Search by meaning | `search_codebase` finds items by description, not just name | ☐ |

---

## Benchmark 8: Agile Workflow (No Gates)

**What it tests:** Commands can be called in any order without blocking

### Steps
1. Start fresh with `gemini` in a project
2. Try these out-of-order calls:

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 8.1 | `/implement` without `/build` | Should inform user no plan exists but not crash | ☐ |
| 8.2 | `/test` without `/implement` | Should work — tests whatever code exists | ☐ |
| 8.3 | `/review` first | Should review existing codebase if present | ☐ |
| 8.4 | `/read` on empty project | Should handle gracefully, offer to init | ☐ |
| 8.5 | `/docs` anytime | Should generate docs from whatever state exists | ☐ |
| 8.6 | Multiple `/build` runs | Should be able to re-plan without breaking state | ☐ |

---

## Benchmark 9: App Runner (`/launch`)

**What it tests:** Launch an app, monitor logs, surface errors

### Steps
1. After `/implement`, type `/launch`

### Checkpoints

| # | Checkpoint | How to Verify | Pass? |
|---|-----------|---------------|-------|
| 9.1 | App starts | `get_app_status` shows running process with PID | ☐ |
| 9.2 | Logs captured | `get_app_logs` returns stdout/stderr output | ☐ |
| 9.3 | Errors surfaced | Runtime errors appear in the context board | ☐ |
| 9.4 | Stop works | `stop_app` terminates the process cleanly | ☐ |

---

## Benchmark 10: Full End-to-End Run

**What it tests:** Complete workflow from empty directory to working app

### Steps
```
mkdir ~/test-e2e && cd ~/test-e2e
gemini

# Step 1: Init
> Initialize a new project called "TaskAPI" - a REST API for task management with Node.js and Express

# Step 2: Plan
> /build

# Step 3: Implement
> /implement

# Step 4: Test
> /test

# Step 5: Review
> /review

# Step 6: Launch
> /launch

# Step 7: Docs
> /docs

# Step 8: Dashboard
> /dashboard
```

### Final Scorecard

| Area | Checkpoints | Passed | Score |
|------|------------|--------|-------|
| Code Intelligence | 7 | | /7 |
| Planning | 7 | | /7 |
| Implementation | 7 | | /7 |
| Testing | 6 | | /6 |
| Code Review | 5 | | /5 |
| Dashboard | 10 | | /10 |
| Shared Memory | 8 | | /8 |
| Agile Workflow | 6 | | /6 |
| App Runner | 4 | | /4 |
| **Total** | **60** | | **/60** |

---

## Quick Smoke Test (5 minutes)

If you only have 5 minutes, test these 5 things:

1. **`/read` on an existing project** → `.weaver/` created with `index.json`
2. **`/build` with a feature request** → `plan.json` with change groups
3. **`/implement`** → actual code files on disk
4. **Dashboard** → `npm run dev`, open browser, see agents + context board
5. **Shared memory** → PM's output references architect's decisions

If all 5 pass, the core loop works. ✅
