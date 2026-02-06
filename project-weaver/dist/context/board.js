import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AGENT_ROLES, PIPELINE_STAGES, } from '../types.js';
const WEAVER_DIR = '.weaver';
const CONTEXT_FILE = 'context.json';
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
        const stages = {};
        for (const stage of PIPELINE_STAGES) {
            stages[stage] = { status: 'pending' };
        }
        const board = {
            version: '1.0.0',
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
            pipeline: {
                currentStage: 'spec',
                stages,
            },
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
    /** Read the context board from disk */
    readBoard() {
        const raw = fs.readFileSync(this.contextFilePath, 'utf-8');
        return JSON.parse(raw);
    }
    /** Write the context board to disk */
    writeBoard(board) {
        board.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.contextFilePath, JSON.stringify(board, null, 2), 'utf-8');
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
            stage: entry.stage,
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
            role, // ensure role is never overwritten
            lastActive: new Date().toISOString(),
        };
        this.writeBoard(board);
    }
    /** Advance a pipeline stage */
    advanceStage(stage, status, agent) {
        const board = this.readBoard();
        const now = new Date().toISOString();
        if (status === 'in-progress') {
            board.pipeline.stages[stage].status = 'in-progress';
            board.pipeline.stages[stage].startedAt = now;
            board.pipeline.currentStage = stage;
            if (agent)
                board.pipeline.stages[stage].assignedAgent = agent;
        }
        else if (status === 'complete') {
            board.pipeline.stages[stage].status = 'complete';
            board.pipeline.stages[stage].completedAt = now;
        }
        this.writeBoard(board);
        this.logEvent({
            level: 'info',
            stage,
            agent,
            action: `stage_${status === 'in-progress' ? 'started' : 'completed'}`,
            message: `Pipeline stage "${stage}" ${status === 'in-progress' ? 'started' : 'completed'}`,
        });
    }
    /** Get filtered entries from the context board */
    getFilteredEntries(filters) {
        const board = this.readBoard();
        let entries = board.entries;
        if (filters?.agent)
            entries = entries.filter(e => e.agent === filters.agent);
        if (filters?.stage)
            entries = entries.filter(e => e.stage === filters.stage);
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
    trackFile(filePath, agent, stage) {
        const board = this.readBoard();
        const stat = fs.existsSync(path.join(this.workspacePath, filePath))
            ? fs.statSync(path.join(this.workspacePath, filePath))
            : null;
        const file = {
            path: filePath,
            agent,
            stage,
            timestamp: new Date().toISOString(),
            size: stat?.size ?? 0,
        };
        // Update or add
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
    /** Update project context (e.g., from requirements gathering) */
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
        // Ensure logs directory exists
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