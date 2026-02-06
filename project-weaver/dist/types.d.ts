export type AgentRole = 'product-manager' | 'architect' | 'developer' | 'qa' | 'code-reviewer';
export type PipelineStage = 'spec' | 'stories' | 'architecture' | 'implementation' | 'testing' | 'review' | 'ship';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'blocked' | 'done' | 'error';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type EntryType = 'decision' | 'artifact' | 'question' | 'feedback' | 'handoff';
export type StageStatus = 'pending' | 'in-progress' | 'complete' | 'skipped';
export interface ContextEntry {
    id: string;
    timestamp: string;
    agent: AgentRole;
    stage: PipelineStage;
    type: EntryType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
    parentId?: string;
}
export interface AgentState {
    role: AgentRole;
    status: AgentStatus;
    currentTask?: string;
    lastActive: string;
    output?: string;
}
export interface ProjectContext {
    name: string;
    description: string;
    requirements: string[];
    techStack?: string[];
    constraints?: string[];
    targetUsers?: string;
    deploymentTarget?: string;
    existingIntegrations?: string;
}
export interface TrackedFile {
    path: string;
    agent: AgentRole;
    stage: PipelineStage;
    timestamp: string;
    size: number;
}
export interface RequirementsQuestion {
    id: string;
    question: string;
    field: keyof ProjectContext | 'custom';
    answered: boolean;
    answer?: string;
}
export type WidgetType = 'diagram' | 'kpi' | 'table' | 'timeline' | 'workflow' | 'list' | 'text' | 'chart';
export type DiagramType = 'gantt' | 'flowchart' | 'sequence' | 'er' | 'class' | 'state' | 'pie' | 'journey' | 'gitgraph' | 'mindmap' | 'timeline' | 'C4';
export interface BaseWidget {
    id: string;
    type: WidgetType;
    title: string;
    order: number;
}
export interface DiagramWidget extends BaseWidget {
    type: 'diagram';
    diagramType: DiagramType;
    code: string;
}
export interface KPIWidget extends BaseWidget {
    type: 'kpi';
    metrics: {
        label: string;
        value: string | number;
        target?: string | number;
        unit?: string;
        status?: 'on-track' | 'at-risk' | 'critical' | 'complete';
        trend?: 'up' | 'down' | 'stable';
    }[];
}
export interface TableWidget extends BaseWidget {
    type: 'table';
    headers: string[];
    rows: string[][];
}
export interface TimelineWidget extends BaseWidget {
    type: 'timeline';
    milestones: {
        date: string;
        title: string;
        description?: string;
        status: 'completed' | 'in-progress' | 'upcoming' | 'delayed';
        dependencies?: string[];
    }[];
}
export interface WorkflowWidget extends BaseWidget {
    type: 'workflow';
    steps: {
        name: string;
        status: 'completed' | 'active' | 'pending' | 'blocked';
        assignee?: string;
        dueDate?: string;
        blockedReason?: string;
        description?: string;
    }[];
}
export interface ListWidget extends BaseWidget {
    type: 'list';
    listType: 'checklist' | 'bullet' | 'numbered' | 'requirements';
    items: {
        text: string;
        completed?: boolean;
        priority?: TaskPriority;
        category?: string;
    }[];
}
export interface TextWidget extends BaseWidget {
    type: 'text';
    content: string;
}
export interface ChartWidget extends BaseWidget {
    type: 'chart';
    chartType: 'line' | 'bar' | 'pie' | 'area';
    data: Record<string, unknown>[];
    xKey: string;
    yKeys: string[];
    colors?: string[];
}
export type DashboardWidget = DiagramWidget | KPIWidget | TableWidget | TimelineWidget | WorkflowWidget | ListWidget | TextWidget | ChartWidget;
export interface StageInfo {
    status: StageStatus;
    startedAt?: string;
    completedAt?: string;
    assignedAgent?: AgentRole;
}
export interface ContextBoard {
    version: string;
    projectId: string;
    project: ProjectContext;
    agents: Record<AgentRole, AgentState>;
    entries: ContextEntry[];
    files: TrackedFile[];
    widgets: DashboardWidget[];
    pipeline: {
        currentStage: PipelineStage;
        stages: Record<PipelineStage, StageInfo>;
    };
    createdAt: string;
    updatedAt: string;
}
export interface WeaverEvent {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    agent?: AgentRole;
    stage?: PipelineStage;
    action: string;
    message: string;
    data?: Record<string, unknown>;
}
export declare const AGENT_ROLES: AgentRole[];
export declare const PIPELINE_STAGES: PipelineStage[];
export declare const STAGE_AGENT_MAP: Record<PipelineStage, AgentRole>;
export declare const STAGE_DESCRIPTIONS: Record<PipelineStage, string>;
export declare const AGENT_DISPLAY_NAMES: Record<AgentRole, string>;
