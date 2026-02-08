import { ContextBoard, ContextEntry, AgentRole, AgentState, ProjectPhase, WeaverEvent, EntryType, TrackedFile, DashboardWidget, ProjectContext, RequirementsQuestion, ProjectIndex, ProjectPlan, ProposedChange, BrainstormEntry } from '../types.js';
export declare class BoardManager {
    private workspacePath;
    constructor(workspacePath: string);
    private get weaverDir();
    private get contextFilePath();
    private get indexFilePath();
    private get planFilePath();
    private get logsDir();
    private get artifactsDir();
    private generateId;
    /** Check if a .weaver/ project exists in the workspace */
    exists(): boolean;
    /** Initialize .weaver/ directory with a fresh context board */
    initProject(projectName: string, description: string, requirements?: string[], techStack?: string[]): ContextBoard;
    /** Read the context board from disk (with migration from old format) */
    readBoard(): ContextBoard;
    /** Write the context board to disk */
    writeBoard(board: ContextBoard): void;
    /** Set the current project phase */
    setPhase(phase: ProjectPhase): void;
    /** Add an entry to the context board */
    addEntry(entry: Omit<ContextEntry, 'id' | 'timestamp'>): ContextEntry;
    /** Update an agent's state */
    updateAgentState(role: AgentRole, updates: Partial<Omit<AgentState, 'role'>>): void;
    /** Write the project plan to board and standalone file */
    writePlan(plan: ProjectPlan): void;
    /** Read the project plan */
    readPlan(): ProjectPlan | null;
    /** Add a proposed change to a change group in the plan */
    addProposedChange(groupId: string, groupName: string, groupDescription: string, agent: AgentRole, change: ProposedChange): void;
    /** Add a brainstorm entry to the plan discussion */
    addBrainstormEntry(entry: Omit<BrainstormEntry, 'id' | 'timestamp'>): BrainstormEntry;
    /** Write the project index to .weaver/index.json */
    writeIndex(index: ProjectIndex): void;
    /** Read the project index from .weaver/index.json */
    readIndex(): ProjectIndex | null;
    /** Get filtered entries from the context board */
    getFilteredEntries(filters?: {
        agent?: AgentRole;
        phase?: ProjectPhase;
        type?: EntryType;
        limit?: number;
    }): ContextEntry[];
    /** Save an artifact file (code, docs, etc.) */
    saveArtifact(filename: string, content: string): string;
    /** Track a file written to the workspace by an agent */
    trackFile(filePath: string, agent: AgentRole, phase: ProjectPhase): TrackedFile;
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
