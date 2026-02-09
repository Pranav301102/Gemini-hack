# 🕸️ Project Weaver — AI Software Agency

> A Gemini CLI Extension that turns a single AI model into a **coordinated team of 5 specialized agents** with shared memory, intelligent code indexing, and a real-time observability dashboard.

**Hackathon Track:** 🧠 The Marathon Agent · ☯️ Vibe Engineering

---

## The Problem

When AI agents work on codebases, they suffer from **amnesia**. Every prompt starts fresh — re-reading files, re-discovering architecture, losing context from prior decisions. Multiple agents can't collaborate because they have no shared state. There's no visibility into what agents are doing, and no way to review or approve their work.

## The Solution

Project Weaver provides three things that don't exist today:

### 1. 🧠 Shared Agent Memory (Context Board)
A persistent JSON-based context board that all 5 agents read from and write to. Every brainstorm observation, architectural decision, code artifact, and QA result is recorded once and accessible to all agents. The Developer reads the Architect's style guide. QA maps test cases to the PM's acceptance criteria. The Code Reviewer references the dependency graph. **No agent ever re-reads the codebase from scratch.**

### 2. 🔬 Intelligent Code Indexing
AST-powered code indexing (via `ast-grep`) that parses functions, classes, interfaces, imports/exports, and type definitions. An LLM enrichment pipeline adds natural-language descriptions to every symbol. Agents can then **search by meaning** ("find the authentication middleware") instead of by filename. Dependency graphs, class hierarchies, call graphs, and API maps are all pre-computed and queryable.

### 3. 📊 Real-Time Observability Dashboard
A Next.js dashboard connected via SSE that shows:
- All 5 agent statuses (idle / working / thinking / done)
- The Context Board with all entries, filterable by agent and phase
- Code Intelligence views (class maps, module architecture, call graphs)
- The full project plan with change groups and file maps
- A centralized documentation browser
- Gemini-powered features: code explanation, codebase chat, AI-enriched index

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Gemini CLI                            │
│  User runs /read, /build, /implement, /test, /review... │
└─────────────────┬───────────────────────────────────────┘
                  │ MCP (stdio)
┌─────────────────▼───────────────────────────────────────┐
│              Project Weaver MCP Server                   │
│  45 tools across 16 modules                              │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Indexer   │ │ Planner  │ │ Agents   │ │ App      │   │
│  │ AST parse │ │ Changes  │ │ 5 roles  │ │ Runner   │   │
│  │ Enrichment│ │ Brainstorm│ │ Assign   │ │ Logs     │   │
│  │ Code Maps │ │ File Map │ │ Revisions│ │ Monitor  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Context  │ │ File Ops │ │ Shell    │ │ Docs     │   │
│  │ Board    │ │ R/W/Del  │ │ Commands │ │ CRUD     │   │
│  │ Shared   │ │ Tracking │ │ Timeouts │ │ Versioned│   │
│  │ Memory   │ │ Locking  │ │ 120s max │ │ Tagged   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                        │                                 │
│              .weaver/  │  (persistent state)             │
│   context.json · index.json · plan.json · code-maps.json │
│   docs.json · logs/events.jsonl                          │
└─────────────────┬───────────────────────────────────────┘
                  │ File watch + SSE
┌─────────────────▼───────────────────────────────────────┐
│            Observability Dashboard (Next.js)             │
│                                                          │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Plan   │  │ Context Board│  │ Agent Activity    │   │
│  │Navigator│  │ Code Intel   │  │ Feed (real-time)  │   │
│  │ Agents  │  │ Plan Detail  │  │ SSE events        │   │
│  │ Status  │  │ Docs Browser │  │ Log stream        │   │
│  └─────────┘  └──────────────┘  └──────────────────┘   │
│                                                          │
│  Gemini-Powered: Chat · Explain · Enrich · Summarize    │
└─────────────────────────────────────────────────────────┘
```

## The 5 Agents

| Agent | Role | What They Access |
|-------|------|-----------------|
| 🏗️ **Architect** | Scans codebases, designs architecture, writes style guides, creates Mermaid diagrams | Code index, dependency graph, code maps, enrichment pipeline |
| 📋 **Product Manager** | Breaks requirements into specs and user stories with acceptance criteria | Context board (reads architect's decisions), project context |
| 💻 **Developer** | Writes production code following the style guide, handles revision requests | Style guide, plan file map, code index, shell commands |
| 🧪 **QA Engineer** | Maps acceptance criteria to tests, runs test suites, reports bugs | PM's specs, developer's files, shell for test execution |
| 🔍 **Code Reviewer** | Reviews for correctness, security, performance, style compliance | Code maps, enriched index, context board history |

## Commands (Agile — Run Any, Anytime)

| Command | What It Does |
|---------|--------------|
| `/read` | Scan an existing project → build code index → generate code maps |
| `/build` | Architect + PM brainstorm together → create a structured plan |
| `/implement` | Developer writes all code files following the plan |
| `/test` | QA writes and runs tests against acceptance criteria |
| `/review` | Code Reviewer evaluates the implementation |
| `/ship` | Generate deployment summary and shipping report |
| `/launch` | Launch the app and monitor logs in real-time |
| `/docs` | Generate comprehensive project documentation |
| `/dashboard` | Open the observability dashboard |
| `/status` | Quick project status check |

> **No sequential gates.** The user drives the workflow — call any command in any order. Agents check current project state and adapt.

## 45 MCP Tools

<details>
<summary>Click to expand full tool list</summary>

**Project Init (3):** `init_project` · `gather_requirements` · `update_project_context`

**Context Board (3):** `get_context_board` · `update_context_board` · `get_project_status`

**Agent Runner (4):** `assign_agent` · `complete_agent_task` · `get_agent_status` · `request_revision`

**Planner (8):** `run_plan` · `add_proposed_change` · `add_brainstorm_entry` · `save_plan` · `get_plan` · `get_file_change_map` · `request_plan_approval` · `check_plan_approval`

**File Ops (5):** `save_file` · `track_file` · `read_file` · `delete_file` · `list_project_files`

**Code Index (2):** `index_project` · `get_project_index`

**Enrichment (2):** `enrich_index` · `save_enrichments`

**Dependency Graph (1):** `build_dependency_graph`

**Code Intel (3):** `understand_file` · `search_codebase` · `get_dependency_graph`

**Code Maps (2):** `build_code_maps` · `get_code_maps`

**App Runner (4):** `launch_app` · `get_app_status` · `stop_app` · `get_app_logs`

**Docs (4):** `add_doc` · `get_docs` · `update_doc` · `list_doc_categories`

**Shell (1):** `run_command`

**Logging (2):** `log_event` · `read_logs`

**Project Scan (1):** `read_project`

</details>

---

## Quick Start

### Prerequisites
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- Node.js 18+

### Install

```bash
# Clone the repo
git clone <repo-url>
cd project-weaver

# Build the MCP server
npm install
npm run build

# Install the dashboard
cd dashboard
npm install
cd ..
```

### Use with Gemini CLI

```bash
# Navigate to any project you want to work on
cd ~/my-project

# Start Gemini CLI (it auto-discovers the extension)
gemini

# Then use any command:
/read          # Scan and index the codebase
/build         # Plan the work
/implement     # Write the code
/test          # Run tests
/review        # Code review
/dashboard     # Open the live dashboard
```

### Run the Dashboard Standalone

```bash
cd project-weaver/dashboard
npm run dev
# Open http://localhost:3000
# Enter the project path in the top bar
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Runtime | Gemini CLI + Gemini 3 Pro API |
| MCP Server | TypeScript, `@modelcontextprotocol/sdk`, stdio transport |
| AST Parsing | `ast-grep/napi` (Tree-sitter based) |
| Schema Validation | Zod |
| Dashboard | Next.js 15, React 19, Tailwind CSS 4 |
| Real-time | Server-Sent Events (SSE) + `chokidar` file watching |
| AI Features | `@google/generative-ai` (Gemini API direct) |
| Diagrams | Mermaid.js |
| Persistent State | JSON files in `.weaver/` directory |

---

## What Makes This Different

| Feature | Typical AI Coding Tool | Project Weaver |
|---------|----------------------|----------------|
| Memory | None — re-reads everything | Persistent context board + enriched index |
| Agents | Single persona | 5 specialized roles with shared state |
| Code Understanding | Raw file reading | AST-parsed, LLM-enriched, graph-connected |
| Visibility | Terminal output only | Real-time dashboard with SSE |
| Documentation | Manual | Centralized, versioned, multi-agent accessible |
| Workflow | Linear or chat-based | Agile — any command, any order |
| Code Review | None | Structured 7-area review with revision loops |
| Planning | Prompt-based | Architect + PM brainstorm → structured change groups |

---

## License

MIT
