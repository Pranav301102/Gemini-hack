# 🕸️ Agent Weaver — AI-Powered Team Collaboration Platform

> A Gemini CLI Extension that turns AI into a **coordinated team of 5 specialized agents** with shared memory, human-verified code annotations, git-based resource sharing, and a real-time observability dashboard — built for **teams where humans and AI agents work in sync**.

**Hackathon Track:** 🧠 The Marathon Agent · ☯️ Vibe Engineering

---

## The Problem

AI coding tools today have three critical failures:

1. **Agent Amnesia** — Every prompt starts fresh. Re-reads files, re-discovers architecture, loses context from prior decisions.
2. **No Team Sharing** — When one developer scans a project with AI, that intelligence dies in their session. Teammates re-do the same work.
3. **Unverified Intelligence** — AI generates descriptions of what code does, but there's no way for humans to verify, correct, or trust those descriptions across a team.

## The Solution

Agent Weaver is a **platform for AI-powered teams** where resources are shared and agent memory is verified by humans.

### 1. 🧠 Shared Agent Memory (Context Board)
A persistent JSON-based context board that all 5 agents read from and write to. Every brainstorm observation, architectural decision, code artifact, and QA result is recorded once and accessible to all agents. The Developer reads the Architect's style guide. QA maps test cases to the PM's acceptance criteria. **No agent ever re-reads the codebase from scratch.**

### 2. 👥 Git-Based Team Collaboration
The entire `.weaver/` directory is designed to be **committed to git**. When one teammate scans a project with `/read`, every other teammate who pulls gets:
- The full AST-parsed code index (functions, classes, types, imports)
- LLM-enriched descriptions of every symbol
- Pre-computed dependency graphs, class hierarchies, call graphs
- The project plan with change groups and file maps
- All agent observations and decisions
- **Human-verified code annotations** that the whole team can trust

No duplicate work. No re-scanning. One scan serves the entire team.

### 3. 📝 Human-Verified Code Annotations
Agents write detailed notes on code symbols — what functions do, how classes are used, design intent, edge cases, gotchas. These annotations are tagged as **agent-written** until a human reviews and verifies them. Verified annotations become trusted team knowledge that:
- Survives across sessions and team members
- Can be filtered (verified-only for production decisions, all for exploration)
- Include tags for categorization (#auth, #critical-path, #tech-debt)
- Track who verified what and when

### 4. 🔬 Intelligent Code Indexing
AST-powered code indexing (via `ast-grep`) that parses functions, classes, interfaces, imports/exports, and type definitions. An LLM enrichment pipeline adds natural-language descriptions to every symbol. Agents can then **search by meaning** ("find the authentication middleware") instead of by filename.

### 5. 📊 Real-Time Observability Dashboard
A Next.js dashboard connected via SSE that shows:
- All 5 agent statuses with live activity
- The Context Board with brainstorm, proposals, decisions, and artifacts
- Implementation Checklist with progress tracking
- Code Intelligence views (class maps, module architecture, call graphs)
- **Team Panel** — members, code annotations, task claims, activity feed
- The full project plan with change groups and file maps
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
│              Agent Weaver MCP Server                     │
│  55 tools across 19 modules                              │
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
│                                                          │
│  ┌──────────┐ ┌──────────┐        Sync Push/Pull       │
│  │   Team   │ │   Sync   │ ◄────────────────────┐      │
│  │ Git collab│ │ Hub API  │                      │      │
│  │Annotations│ │ Branches │                      │      │
│  └──────────┘ └──────────┘                      │      │
│                        │                         │      │
│              .weaver/  │  (persistent state)     │      │
│   context.json · index.json · plan.json ·       │      │
│   code-maps.json · docs.json · team.json ·      │      │
│   annotations.json · logs/events.jsonl          │      │
└─────────────────┬───────────────────────────────┼──────┘
                  │ File watch + SSE              │
┌─────────────────▼──────────────────────┐        │
│   Observability Dashboard (Next.js)     │        │
│                                         │        │
│  ┌─────────┐  ┌──────────────┐  ┌─────▼──────┐ │
│  │  Plan   │  │ Context Board│  │   Team     │ │
│  │Navigator│  │ Code Intel   │  │  Members   │ │
│  │ Agents  │  │ Plan Detail  │  │Annotations │ │
│  │ Status  │  │ Docs Browser │  │  Activity  │ │
│  └─────────┘  └──────────────┘  └────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Agent Activity Feed (real-time SSE)     │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  Gemini: Chat · Explain · Enrich · Summarize    │
└──────────────────────────────────────────────────┘
                  │
                  │ HTTP (port 4200)
                  ▼
┌─────────────────────────────────────────────────┐
│          Weaver Hub Server (Express)            │
│  Central sync server for team collaboration     │
│                                                  │
│  Storage: ~/.weaver-hub/<repo-hash>/<branch>/   │
│  Endpoints: push · pull · branches · status     │
│  Git-aware: tracks repo + branch for isolation  │
└─────────────────────────────────────────────────┘
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

## 55 MCP Tools

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

**Team Collaboration (7):** `team_status` · `record_team_activity` · `add_team_note` · `claim_task` · `annotate_code` · `verify_annotation` · `get_annotations`

**Hub Sync (3):** `sync_push` · `sync_pull` · `sync_status`

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

#### Option 1: Install from GitHub (Recommended)

```bash
# Install the extension via Gemini CLI
gemini extensions install https://github.com/Pranav301102/Gemini-hack

# Verify installation
gemini extensions list
```

The extension will automatically:
- Clone the repository
- Install dependencies
- Build the MCP server
- Register with Gemini CLI

#### Option 2: Install from Local Path

```bash
# Clone the repo
git clone https://github.com/Pranav301102/Gemini-hack
cd Gemini-hack/project-weaver

# Build the MCP server
npm install
npm run build

# Install the extension from local path
gemini extensions install .

# Verify installation
gemini extensions list
```

#### Optional: Set up Team Collaboration Hub

```bash
# Install and start the Hub server (for team sync features)
cd hub
npm install
npm start &  # Runs on http://localhost:4200
cd ..
```

### Deploy to Vercel (Dashboard Only)

The dashboard can be deployed to Vercel for easy access:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel

# Or use the Vercel GitHub integration
# Just connect your repo and deploy!
```

**Note:** The MCP server runs locally via Gemini CLI. Only the observability dashboard is hosted on Vercel.

### Use with Gemini CLI

Once installed, the extension is available in any Gemini CLI session:

```bash
# Navigate to any project you want to work on
cd ~/my-project

# Start Gemini CLI
gemini

# The Agent Weaver extension is now available!
# Use any command:
/read          # Scan and index the codebase
/build         # Plan the work
/implement     # Write the code
/test          # Run tests
/review        # Code review
/dashboard     # Open the live dashboard
/status        # Quick project status check
```

**Update the extension:**
```bash
gemini extensions update agent-weaver
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
| Hub Server | Express.js, stores team sync data in `~/.weaver-hub/` |
| AST Parsing | `ast-grep/napi` (Tree-sitter based) |
| Schema Validation | Zod |
| Dashboard | Next.js 15, React 19, Tailwind CSS 4 |
| Real-time | Server-Sent Events (SSE) + `chokidar` file watching |
| AI Features | `@google/generative-ai` (Gemini API direct) |
| Diagrams | Mermaid.js |
| Persistent State | JSON files in `.weaver/` directory |

---

## What Makes This Different

| Feature | Typical AI Coding Tool | Agent Weaver |
|---------|----------------------|----------------|
| Memory | None — re-reads everything | Persistent context board + enriched index |
| Agents | Single persona | 5 specialized roles with shared state |
| Code Understanding | Raw file reading | AST-parsed, LLM-enriched, graph-connected |
| Visibility | Terminal output only | Real-time dashboard with SSE |
| Documentation | Manual | Centralized, versioned, multi-agent accessible |
| Workflow | Linear or chat-based | Agile — any command, any order |
| Code Review | None | Structured 7-area review with revision loops |
| Planning | Prompt-based | Architect + PM brainstorm → structured change groups |
| Team Collab | Session-locked | Git-based sharing + Hub sync by branch |
| Code Annotations | Not supported | Human-verified, agent-written, team-shared |

---

## License

MIT
