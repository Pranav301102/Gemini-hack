# Agent Weaver Demo Setup

## What Was Done

### 1. ✅ Created Demo Data Structure
Copied comprehensive demo data from `test-weaver-project` to `project-weaver/.weaver/`:

- **context.json** - Full agent context with 5 agents (Product Manager, Architect, Developer, QA, Code Reviewer) showing their current tasks and collaboration
- **plan.json** - Complete implementation plan with change groups, architecture diagrams, and file maps
- **index.json** - Full codebase index with 25 files, 46 functions, 16 types, and dependency graphs
- **code-maps.json** - AST-generated code intelligence maps (class hierarchies, module connections, call graphs)
- **team.json** - Team collaboration data with 4 members, sync history, and statistics
- **annotations.json** - 156 AI-generated code annotations (89 verified, 34 pending)
- **docs.json** - 4 comprehensive documentation articles (Architecture, MCP Tools, Getting Started, Team Workflow)
- **logs/2026-02-09.jsonl** - Sample activity logs showing agent work

### 2. ✅ Added "See Demo" Button
Updated the landing page (`project-weaver/dashboard/app/page.tsx`) with a prominent "See Demo" button that:
- Links to `/dashboard?demo=true`
- Styled in blue to stand out
- Positioned before the regular "Open Dashboard" button

### 3. ✅ Updated Project Metadata
Modified `.weaver/context.json` to reflect Agent Weaver project details:
- Project name: "agent-weaver"
- Description: Full AI Software Agency description
- Tech stack: TypeScript, Node.js, Next.js, React, MCP SDK, Tree-sitter

### 4. ✅ Configured for Vercel
Updated `vercel.json` for proper Next.js deployment

## Demo Features Available

When users click "See Demo", they'll see:

### Context Board View
- 6 artifact entries from Product Manager and Architect
- Benchmark roadmap table
- Architecture diagrams (current vs proposed)
- Plan metrics and KPIs
- File change maps

### Code Intelligence
- 10 interfaces (AuthRequest, Group, Todo, User, etc.)
- 13 modules with connection maps
- Dependency graphs showing 26 edges
- Entry points and shared modules analysis

### Plan Navigator
- 5 change groups (Documentation, Data Layer, Offline Sync, Capture, Views)
- 8 file changes with priority and complexity
- Architectural notes and risk assessment
- Agent discussion thread with 6 entries

### Team View
- 4 team members with contribution scores
- Sync history (4 recent syncs)
- Team statistics (156 annotations, 85% accuracy)
- Member activity tracking

### Documentation Browser
- 4 comprehensive docs across categories
- Architecture overview with diagrams
- MCP tools reference
- Getting started tutorial
- Team collaboration workflow

### Agent Activity Feed
- Real-time SSE connection (when running locally)
- Activity logs showing agent work
- Phase transitions and decisions

## Tech Stack Showcased

The demo data highlights:
- **MCP SDK** - 55 tools across 19 modules
- **Tree-sitter** - AST parsing for code intelligence
- **Next.js 15** - Real-time dashboard with SSE
- **React 19** - Modern UI components
- **TypeScript** - Full type safety
- **Gemini 3 Pro** - AI-powered agents

## For Developers

The demo is self-contained and works immediately when:
1. Deployed to Vercel
2. Run locally with `cd dashboard && npm run dev`

The dashboard will automatically find the `.weaver` directory in the project root and load all demo data.

## Files Modified/Created

### Created:
- `project-weaver/.weaver/` (entire directory with 10 files)
- `DEMO_SETUP.md` (this file)

### Modified:
- `project-weaver/dashboard/app/page.tsx` - Added "See Demo" button
- `project-weaver/vercel.json` - Updated for Next.js deployment
- `project-weaver/.weaver/context.json` - Updated project metadata

## Next Steps for Deployment

1. Commit all changes:
   ```bash
   git add .
   git commit -m "feat: add demo data and See Demo button for Vercel deployment"
   ```

2. Push to repository

3. Deploy to Vercel - the demo will work immediately!

## Demo URL Structure

- Landing page: `https://your-vercel-url.vercel.app/`
- Demo dashboard: `https://your-vercel-url.vercel.app/dashboard?demo=true`
- Regular dashboard: `https://your-vercel-url.vercel.app/dashboard`

---

**Built for the Gemini 3 Hackathon - February 2026**
