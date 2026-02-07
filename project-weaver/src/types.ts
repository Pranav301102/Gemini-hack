// Agent roles - the 5 specialized dev team members
export type AgentRole = 'product-manager' | 'architect' | 'developer' | 'qa' | 'code-reviewer';

// Pipeline stages: read → architecture → spec → stories → approval → implementation → testing → review → ship
export type PipelineStage = 'read' | 'architecture' | 'spec' | 'stories' | 'approval' | 'implementation' | 'testing' | 'review' | 'ship';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'blocked' | 'done' | 'error';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type EntryType = 'decision' | 'artifact' | 'question' | 'feedback' | 'handoff';

export type StageStatus = 'pending' | 'in-progress' | 'complete' | 'skipped';

// Shared Zod-compatible stage names array (use in z.enum() calls)
export const STAGE_NAMES = ['read', 'architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship'] as const;

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

// ─── Approval Gate ───

export type ApprovalStatus = 'pending' | 'approved' | 'changes-requested';

export interface ApprovalState {
  status: ApprovalStatus;
  reviewedAt?: string;
  comments?: string;
  requestedChanges?: string[];
}

// ─── Style Guide (authored by Architect, enforced by Reviewer) ───

export interface StyleGuide {
  naming: {
    files: string;
    functions: string;
    classes: string;
    constants: string;
    variables: string;
  };
  patterns: string[];
  rules: string[];
  imports: string;
  errorHandling: string;
  testing: string;
}

// ─── Project Code Index (stored in .weaver/index.json) ───

export interface FunctionSignature {
  name: string;
  params: { name: string; type?: string }[];
  returnType?: string;
  exported: boolean;
  line: number;
  description?: string;    // From JSDoc or preceding comment
  isComponent?: boolean;   // React/Vue component
  isAsync?: boolean;
  enrichedDescription?: string;  // LLM-generated semantic description
  purpose?: string;              // Role in the system
}

export interface ClassDefinition {
  name: string;
  methods: { name: string; params: string[]; returnType?: string; description?: string }[];
  properties: { name: string; type?: string }[];
  exported: boolean;
  line: number;
  description?: string;
  extends?: string;
  implements?: string[];
  enrichedDescription?: string;
  purpose?: string;
}

export interface VariableDeclaration {
  name: string;
  type?: string;
  value?: string;          // Short preview of value (truncated)
  kind: 'const' | 'let' | 'var';
  exported: boolean;
  line: number;
  description?: string;
  enrichedDescription?: string;
}

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  fields?: { name: string; type: string; optional?: boolean }[];  // Interface/type fields
  values?: string[];  // Enum values or union members
  description?: string;
  enrichedDescription?: string;
}

export interface FileIndex {
  path: string;
  size: number;
  language: string;
  description?: string;    // File-level description from top comment
  enrichedDescription?: string;  // LLM-generated file summary
  functions: FunctionSignature[];
  classes: ClassDefinition[];
  variables: VariableDeclaration[];
  exports: string[];
  imports: { source: string; names: string[] }[];
  types: TypeDefinition[];
}

export interface ProjectIndex {
  version: string;
  indexedAt: string;
  rootPath: string;
  techStack: string[];
  fileTree: { path: string; size: number; type: 'file' | 'directory' }[];
  files: FileIndex[];
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  totalVariables: number;
  totalTypes: number;
  // Agent Memory fields
  enrichedAt?: string;
  enrichmentProgress?: { totalItems: number; enrichedItems: number; lastBatchFile?: string };
  dependencyGraph?: DependencyGraph;
}

// ─── Dependency Graph (computed from imports) ───

export interface DependencyEdge {
  from: string;   // relative file path
  to: string;     // relative file path (resolved)
  imports: string[];
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  entryPoints: string[];
  sharedModules: { file: string; importedBy: number }[];
  clusters: { directory: string; files: string[]; internalEdges: number; externalEdges: number }[];
  circularDeps: string[][];
}

// ─── Enrichment Types ───

export interface EnrichmentItem {
  file: string;
  name: string;
  kind: 'function' | 'class' | 'type' | 'variable';
  signature: string;
  codeSnippet: string;
  existingDescription?: string;
  line: number;
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
  assignedAgent?: AgentRole | 'user';
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
  approval?: ApprovalState;
  styleGuide?: StyleGuide;
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
export const PIPELINE_STAGES: PipelineStage[] = ['read', 'architecture', 'spec', 'stories', 'approval', 'implementation', 'testing', 'review', 'ship'];

// Maps pipeline stages to responsible agents (approval is user-driven)
export const STAGE_AGENT_MAP: Record<PipelineStage, AgentRole | 'user'> = {
  'read': 'architect',
  'architecture': 'architect',
  'spec': 'product-manager',
  'stories': 'product-manager',
  'approval': 'user',
  'implementation': 'developer',
  'testing': 'qa',
  'review': 'code-reviewer',
  'ship': 'developer',
};

// Human-readable stage descriptions
export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  'read': 'Scan existing codebase and auto-detect project structure, tech stack, and patterns',
  'architecture': 'Design system architecture, file structure, coding style guide, and technical decisions',
  'spec': 'Analyze requirements and create a detailed specification aligned with architecture',
  'stories': 'Break down the spec into user stories with acceptance criteria',
  'approval': 'User reviews architect design and PM spec, then approves or requests changes',
  'implementation': 'Write production code following the style guide',
  'testing': 'Write and run tests for the implementation',
  'review': 'Review code for bugs, security, style guide compliance, and best practices',
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
