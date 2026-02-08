import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AGENT_ROLES, } from '../types.js';
const WEAVER_DIR = '.weaver';
const CONTEXT_FILE = 'context.json';
const INDEX_FILE = 'index.json';
const PLAN_FILE = 'plan.json';
const LOGS_DIR = 'logs';
const ARTIFACTS_DIR = 'artifacts';
export class BoardManager {
    workspacePath;
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
    }
    get weaverDir() {
        return path.join(this.workspacePath, WEAVER_DIR);
    }
    get contextFilePath() {
        return path.join(this.weaverDir, CONTEXT_FILE);
    }
    get indexFilePath() {
        return path.join(this.weaverDir, INDEX_FILE);
    }
    get planFilePath() {
        return path.join(this.weaverDir, PLAN_FILE);
    }
    get logsDir() {
        return path.join(this.weaverDir, LOGS_DIR);
    }
    get artifactsDir() {
        return path.join(this.weaverDir, ARTIFACTS_DIR);
    }
    generateId() {
        return crypto.randomUUID();
    }
    /** Check if a .weaver/ project exists in the workspace */
    exists() {
        return fs.existsSync(this.contextFilePath);
    }
    /** Initialize .weaver/ directory with a fresh context board */
    initProject(projectName, description, requirements = [], techStack = []) {
        fs.mkdirSync(this.weaverDir, { recursive: true });
        fs.mkdirSync(this.logsDir, { recursive: true });
        fs.mkdirSync(this.artifactsDir, { recursive: true });
        const now = new Date().toISOString();
        const agents = {};
        for (const role of AGENT_ROLES) {
            agents[role] = { role, status: 'idle', lastActive: now };
        }
        const board = {
            version: '3.0.0',
            projectId: this.generateId(),
            project: {
                name: projectName,
                description,
                requirements,
                techStack: techStack.length > 0 ? techStack : undefined,
            },
            agents,
            entries: [],
            files: [],
            widgets: [],
            phase: 'read',
            createdAt: now,
            updatedAt: now,
        };
        this.writeBoard(board);
        this.logEvent({
            level: 'info',
            action: 'project_initialized',
            message: `Project "${projectName}" initialized`,
            data: { projectId: board.projectId },
        });
        return board;
    }
    /** Read the context board from disk (with migration from old format) */
    readBoard() {
        const raw = fs.readFileSync(this.contextFilePath, 'utf-8');
        const board = JSON.parse(raw);
        // Migration: old pipeline-based format → new phase-based format
        if (board.pipeline && !board.phase) {
            const currentStage = board.pipeline.currentStage;
            if (currentStage === 'read') {
                board.phase = 'read';
            }
            else {
                board.phase = 'plan';
            }
            delete board.pipeline;
            delete board.approval;
            delete board.styleGuide;
            // Migrate entries: stage → phase
            if (board.entries) {
                for (const entry of board.entries) {
                    if (entry.stage && !entry.phase) {
                        entry.phase = entry.stage === 'read' ? 'read' : 'plan';
                        delete entry.stage;
                    }
                    // Migrate old entry types
                    if (entry.type === 'handoff')
                        entry.type = 'decision';
                    if (entry.type === 'feedback')
                        entry.type = 'proposal';
                }
            }
            // Migrate tracked files
            if (board.files) {
                for (const file of board.files) {
                    if (file.stage && !file.phase) {
                        file.phase = file.stage === 'read' ? 'read' : 'plan';
                        delete file.stage;
                    }
                }
            }
            board.version = '3.0.0';
            this.writeBoard(board);
        }
        return board;
    }
    /** Write the context board to disk */
    writeBoard(board) {
        board.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.contextFilePath, JSON.stringify(board, null, 2), 'utf-8');
    }
    /** Set the current project phase */
    setPhase(phase) {
        const board = this.readBoard();
        board.phase = phase;
        this.writeBoard(board);
        this.logEvent({
            level: 'info',
            phase,
            action: 'phase_changed',
            message: `Phase changed to: ${phase}`,
        });
    }
    /** Add an entry to the context board */
    addEntry(entry) {
        const board = this.readBoard();
        const fullEntry = {
            ...entry,
            id: this.generateId(),
            timestamp: new Date().toISOString(),
        };
        board.entries.push(fullEntry);
        this.writeBoard(board);
        this.logEvent({
            level: 'info',
            agent: entry.agent,
            phase: entry.phase,
            action: `context_${entry.type}`,
            message: `[${entry.agent}] ${entry.type}: ${entry.title}`,
            data: { entryId: fullEntry.id },
        });
        return fullEntry;
    }
    /** Update an agent's state */
    updateAgentState(role, updates) {
        const board = this.readBoard();
        board.agents[role] = {
            ...board.agents[role],
            ...updates,
            role,
            lastActive: new Date().toISOString(),
        };
        this.writeBoard(board);
    }
    /** Write the project plan to board and standalone file */
    writePlan(plan) {
        const board = this.readBoard();
        board.plan = plan;
        board.phase = 'ready';
        this.writeBoard(board);
        // Also write standalone plan file
        fs.writeFileSync(this.planFilePath, JSON.stringify(plan, null, 2), 'utf-8');
        this.logEvent({
            level: 'info',
            action: 'plan_saved',
            message: `Plan saved with ${plan.changeGroups.length} change groups`,
            data: {
                totalChanges: plan.changeGroups.reduce((sum, g) => sum + g.changes.length, 0),
                totalFiles: plan.fileMap.length,
            },
        });
    }
    /** Read the project plan */
    readPlan() {
        const board = this.readBoard();
        if (board.plan)
            return board.plan;
        // Fallback to standalone file
        if (fs.existsSync(this.planFilePath)) {
            const raw = fs.readFileSync(this.planFilePath, 'utf-8');
            return JSON.parse(raw);
        }
        return null;
    }
    /** Add a proposed change to a change group in the plan */
    addProposedChange(groupId, groupName, groupDescription, agent, change) {
        const board = this.readBoard();
        if (!board.plan) {
            // Initialize a plan skeleton
            board.plan = {
                id: this.generateId(),
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                summary: '',
                goals: [],
                approach: '',
                changeGroups: [],
                architectureNotes: '',
                riskAssessment: '',
                fileMap: [],
                discussion: [],
                diagrams: [],
            };
        }
        let group = board.plan.changeGroups.find(g => g.id === groupId);
        if (!group) {
            group = {
                id: groupId,
                name: groupName,
                description: groupDescription,
                agent,
                changes: [],
                order: board.plan.changeGroups.length,
            };
            board.plan.changeGroups.push(group);
        }
        group.changes.push(change);
        board.plan.updatedAt = new Date().toISOString();
        this.writeBoard(board);
    }
    /** Add a brainstorm entry to the plan discussion */
    addBrainstormEntry(entry) {
        const board = this.readBoard();
        if (!board.plan) {
            board.plan = {
                id: this.generateId(),
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                summary: '',
                goals: [],
                approach: '',
                changeGroups: [],
                architectureNotes: '',
                riskAssessment: '',
                fileMap: [],
                discussion: [],
                diagrams: [],
            };
        }
        const fullEntry = {
            ...entry,
            id: this.generateId(),
            timestamp: new Date().toISOString(),
        };
        board.plan.discussion.push(fullEntry);
        board.plan.updatedAt = new Date().toISOString();
        this.writeBoard(board);
        return fullEntry;
    }
    /** Write the project index to .weaver/index.json */
    writeIndex(index) {
        fs.writeFileSync(this.indexFilePath, JSON.stringify(index, null, 2), 'utf-8');
    }
    /** Read the project index from .weaver/index.json */
    readIndex() {
        if (!fs.existsSync(this.indexFilePath))
            return null;
        const raw = fs.readFileSync(this.indexFilePath, 'utf-8');
        return JSON.parse(raw);
    }
    /** Get filtered entries from the context board */
    getFilteredEntries(filters) {
        const board = this.readBoard();
        let entries = board.entries;
        if (filters?.agent)
            entries = entries.filter(e => e.agent === filters.agent);
        if (filters?.phase)
            entries = entries.filter(e => e.phase === filters.phase);
        if (filters?.type)
            entries = entries.filter(e => e.type === filters.type);
        const limit = filters?.limit ?? 50;
        return entries.slice(-limit);
    }
    /** Save an artifact file (code, docs, etc.) */
    saveArtifact(filename, content) {
        const filePath = path.join(this.artifactsDir, filename);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    /** Track a file written to the workspace by an agent */
    trackFile(filePath, agent, phase) {
        const board = this.readBoard();
        const stat = fs.existsSync(path.join(this.workspacePath, filePath))
            ? fs.statSync(path.join(this.workspacePath, filePath))
            : null;
        const file = {
            path: filePath,
            agent,
            phase,
            timestamp: new Date().toISOString(),
            size: stat?.size ?? 0,
        };
        const idx = board.files.findIndex(f => f.path === filePath);
        if (idx >= 0) {
            board.files[idx] = file;
        }
        else {
            board.files.push(file);
        }
        this.writeBoard(board);
        return file;
    }
    /** Update project context */
    updateProjectContext(updates) {
        const board = this.readBoard();
        board.project = { ...board.project, ...updates };
        this.writeBoard(board);
    }
    /** Add a widget to the dashboard */
    addWidget(widget) {
        const board = this.readBoard();
        board.widgets.push(widget);
        this.writeBoard(board);
    }
    /** Add multiple widgets at once */
    addWidgets(widgets) {
        const board = this.readBoard();
        board.widgets.push(...widgets);
        this.writeBoard(board);
    }
    /** Get requirements questions for software projects */
    getRequirementsQuestions() {
        return [
            { id: 'q1', question: 'What problem does this software solve? Who is it for?', field: 'description', answered: false },
            { id: 'q2', question: 'Who are the target users? (developers, end-users, admins, etc.)', field: 'targetUsers', answered: false },
            { id: 'q3', question: 'What are the core must-have features?', field: 'requirements', answered: false },
            { id: 'q4', question: 'Any nice-to-have features or future considerations?', field: 'requirements', answered: false },
            { id: 'q5', question: 'Preferred tech stack? (e.g., React, Node.js, Python, etc.)', field: 'techStack', answered: false },
            { id: 'q6', question: 'Any existing code, APIs, or services to integrate with?', field: 'existingIntegrations', answered: false },
            { id: 'q7', question: 'Performance or scale requirements? (users, data volume, latency)', field: 'constraints', answered: false },
            { id: 'q8', question: 'Any design or UX preferences? (dark mode, minimal, dashboard-style, etc.)', field: 'custom', answered: false },
            { id: 'q9', question: 'Deployment target? (web app, CLI tool, mobile, desktop, API, etc.)', field: 'deploymentTarget', answered: false },
            { id: 'q10', question: 'Any other constraints or priorities? (timeline, budget, security, accessibility)', field: 'constraints', answered: false },
        ];
    }
    /** Append a log event to the JSONL log file */
    logEvent(event) {
        const fullEvent = {
            ...event,
            id: this.generateId(),
            timestamp: new Date().toISOString(),
        };
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        const dateStr = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `${dateStr}.jsonl`);
        fs.appendFileSync(logFile, JSON.stringify(fullEvent) + '\n', 'utf-8');
    }
    /** Read log events from a specific date */
    readLogs(date) {
        const dateStr = date ?? new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `${dateStr}.jsonl`);
        if (!fs.existsSync(logFile))
            return [];
        const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
        return lines.map(line => JSON.parse(line));
    }
}
//# sourceMappingURL=board.js.map