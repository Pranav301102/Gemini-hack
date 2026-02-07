import { ContextBoard, ContextEntry, AgentRole, AgentState, PipelineStage, WeaverEvent, EntryType, TrackedFile, DashboardWidget, ProjectContext, RequirementsQuestion, ApprovalState, ProjectIndex } from '../types.js';
export declare class BoardManager {
    private workspacePath;
    constructor(workspacePath: string);
    private get weaverDir();
    private get contextFilePath();
    private get indexFilePath();
    private get logsDir();
    private get artifactsDir();
    private generateId;
    /** Check if a .weaver/ project exists in the workspace */
    exists(): boolean;
    /** Initialize .weaver/ directory with a fresh context board */
    initProject(projectName: string, description: string, requirements?: string[], techStack?: string[]): ContextBoard;
    /** Read the context board from disk */
    readBoard(): ContextBoard;
    /** Write the context board to disk */
    writeBoard(board: ContextBoard): void;
    /** Add an entry to the context board */
    addEntry(entry: Omit<ContextEntry, 'id' | 'timestamp'>): ContextEntry;
    /** Update an agent's state */
    updateAgentState(role: AgentRole, updates: Partial<Omit<AgentState, 'role'>>): void;
    /** Advance a pipeline stage */
    advanceStage(stage: PipelineStage, status: 'in-progress' | 'complete', agent?: AgentRole | 'user'): void;
    /** Reset pipeline from a given stage onwards */
    resetToStage(stage: PipelineStage): void;
    /** Set the approval gate state */
    setApproval(approval: ApprovalState): void;
    /** Get the current approval state */
    getApproval(): ApprovalState | undefined;
    /** Write the project index to .weaver/index.json */
    writeIndex(index: ProjectIndex): void;
    /** Read the project index from .weaver/index.json */
    readIndex(): ProjectIndex | null;
    /** Get filtered entries from the context board */
    getFilteredEntries(filters?: {
        agent?: AgentRole;
        stage?: PipelineStage;
        type?: EntryType;
        limit?: number;
    }): ContextEntry[];
    /** Save an artifact file (code, docs, etc.) */
    saveArtifact(filename: string, content: string): string;
    /** Track a file written to the workspace by an agent */
    trackFile(filePath: string, agent: AgentRole, stage: PipelineStage): TrackedFile;
    /** Update project context */
    updateProjectContext(updates: Partial<ProjectContext>): void;
    /** Add a widget to the dashboard */
    addWidget(widget: DashboardWidget): void;
    /** Add multiple widgets at once */
    addWidgets(widgets: DashboardWidget[]): void;
    /** Get requirements questions for software projects */
    getRequirementsQuestions(): RequirementsQuestion[];
    /** Append a log event to the JSONL log file */
    logEvent(event: Omit<WeaverEvent, 'id' | 'timestamp'>): void;
    /** Read log events from a specific date */
    readLogs(date?: string): WeaverEvent[];
}
