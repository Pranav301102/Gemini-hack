// Agent roles - the 5 specialized dev team members
export type AgentRole = 'product-manager' | 'architect' | 'developer' | 'qa' | 'code-reviewer';

// Pipeline stages from spec to ship
export type PipelineStage = 'spec' | 'stories' | 'architecture' | 'implementation' | 'testing' | 'review' | 'ship';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'blocked' | 'done' | 'error';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type EntryType = 'decision' | 'artifact' | 'question' | 'feedback' | 'handoff';

export type StageStatus = 'pending' | 'in-progress' | 'complete' | 'skipped';

// Context board entry - how agents communicate
export interface ContextEntry {
  id: string;
  timestamp: string;
  agent: AgentRole;
  stage: PipelineStage;
  type: EntryType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  parentId?: string; // For threaded discussions between agents
}

// Individual agent state
export interface AgentState {
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string;
  lastActive: string;
  output?: string;
}

// Project context gathered from the user
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

// Tracked file written by Developer/QA agents
export interface TrackedFile {
  path: string;
  agent: AgentRole;
  stage: PipelineStage;
  timestamp: string;
  size: number;
}

// Requirements questions for gathering project info
export interface RequirementsQuestion {
  id: string;
  question: string;
  field: keyof ProjectContext | 'custom';
  answered: boolean;
  answer?: string;
}

// ─── Structured Widget Types (ported from clin-ops) ───

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

export type DashboardWidget =
  | DiagramWidget
  | KPIWidget
  | TableWidget
  | TimelineWidget
  | WorkflowWidget
  | ListWidget
  | TextWidget
  | ChartWidget;

// Pipeline stage tracking
export interface StageInfo {
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  assignedAgent?: AgentRole;
}

// The full context board - shared state for all agents
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

// Log event for the observability dashboard
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

// All agent roles as array for iteration
export const AGENT_ROLES: AgentRole[] = ['product-manager', 'architect', 'developer', 'qa', 'code-reviewer'];

// All pipeline stages in order
export const PIPELINE_STAGES: PipelineStage[] = ['spec', 'stories', 'architecture', 'implementation', 'testing', 'review', 'ship'];

// Maps pipeline stages to responsible agents
export const STAGE_AGENT_MAP: Record<PipelineStage, AgentRole> = {
  'spec': 'product-manager',
  'stories': 'product-manager',
  'architecture': 'architect',
  'implementation': 'developer',
  'testing': 'qa',
  'review': 'code-reviewer',
  'ship': 'developer',
};

// Human-readable stage descriptions
export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  'spec': 'Analyze requirements and create a detailed specification',
  'stories': 'Break down the spec into user stories with acceptance criteria',
  'architecture': 'Design system architecture, file structure, and technical decisions',
  'implementation': 'Write production code across all files',
  'testing': 'Write and run tests for the implementation',
  'review': 'Review code for bugs, security, and best practices',
  'ship': 'Finalize and prepare the project for deployment',
};

// Agent display names
export const AGENT_DISPLAY_NAMES: Record<AgentRole, string> = {
  'product-manager': 'Product Manager',
  'architect': 'Architect',
  'developer': 'Developer',
  'qa': 'QA Engineer',
  'code-reviewer': 'Code Reviewer',
};
