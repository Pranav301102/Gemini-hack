// Agent roles - core planning agents + on-demand execution agents
export type AgentRole = 'product-manager' | 'architect' | 'developer' | 'qa' | 'code-reviewer';

// Project phases: read → plan → ready
export type ProjectPhase = 'read' | 'plan' | 'ready';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'done';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type EntryType = 'brainstorm' | 'proposal' | 'decision' | 'artifact' | 'question' | 'memory-map';

// Context board entry - how agents communicate
export interface ContextEntry {
  id: string;
  timestamp: string;
  agent: AgentRole;
  phase: ProjectPhase;
  type: EntryType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  parentId?: string;
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
  isExistingProject?: boolean;
}

// Tracked file written by agents
export interface TrackedFile {
  path: string;
  agent: AgentRole;
  phase: ProjectPhase;
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

// ─── Plan & Memory Map Types ───

export type ChangeType = 'create' | 'modify' | 'refactor' | 'delete' | 'extend';
export type ChangePriority = 'must-have' | 'should-have' | 'nice-to-have';
export type ChangeComplexity = 'trivial' | 'small' | 'medium' | 'large' | 'epic';

/** A single proposed change to a specific location in the codebase */
export interface ProposedChange {
  id: string;
  file: string;
  changeType: ChangeType;
  title: string;
  description: string;
  rationale: string;
  priority: ChangePriority;
  complexity: ChangeComplexity;
  affectedFunctions?: string[];
  affectedClasses?: string[];
  affectedTypes?: string[];
  dependencies: string[];
  codeSnippet?: string;
}

/** A group of related changes that form a logical unit */
export interface ChangeGroup {
  id: string;
  name: string;
  description: string;
  agent: AgentRole;
  changes: ProposedChange[];
  order: number;
}

/** The complete plan document with memory maps */
export interface ProjectPlan {
  id: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  goals: string[];
  approach: string;
  changeGroups: ChangeGroup[];
  architectureNotes: string;
  riskAssessment: string;
  fileMap: FileChangeMap[];
  discussion: BrainstormEntry[];
  diagrams: PlanDiagram[];
}

/** Summary of all changes to a single file */
export interface FileChangeMap {
  file: string;
  exists: boolean;
  language: string;
  currentDescription?: string;
  changes: { changeId: string; changeType: ChangeType; summary: string }[];
  totalChanges: number;
  maxPriority: ChangePriority;
}

/** A brainstorm entry from the agent discussion */
export interface BrainstormEntry {
  id: string;
  timestamp: string;
  agent: AgentRole;
  type: 'observation' | 'proposal' | 'question' | 'agreement' | 'counter-proposal' | 'decision';
  content: string;
  referencedFiles?: string[];
  referencedChanges?: string[];
}

/** Architecture diagram in the plan */
export interface PlanDiagram {
  id: string;
  title: string;
  type: 'current-architecture' | 'proposed-architecture' | 'change-impact' | 'dependency-flow';
  mermaidCode: string;
}

// ─── Project Code Index (stored in .weaver/index.json) ───

export interface FunctionSignature {
  name: string;
  params: { name: string; type?: string }[];
  returnType?: string;
  exported: boolean;
  line: number;
  description?: string;
  isComponent?: boolean;
  isAsync?: boolean;
  enrichedDescription?: string;
  purpose?: string;
  callsites?: { name: string; line: number }[];
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
  value?: string;
  kind: 'const' | 'let' | 'var';
  exported: boolean;
  line: number;
  description?: string;
  enrichedDescription?: string;
}

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  fields?: { name: string; type: string; optional?: boolean }[];
  values?: string[];
  description?: string;
  enrichedDescription?: string;
}

export interface FileIndex {
  path: string;
  size: number;
  language: string;
  description?: string;
  enrichedDescription?: string;
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
  enrichedAt?: string;
  enrichmentProgress?: { totalItems: number; enrichedItems: number; lastBatchFile?: string };
  dependencyGraph?: DependencyGraph;
  codeMaps?: CodeMaps;
}

// ─── Dependency Graph (computed from imports) ───

export interface DependencyEdge {
  from: string;
  to: string;
  imports: string[];
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  entryPoints: string[];
  sharedModules: { file: string; importedBy: number }[];
  clusters: { directory: string; files: string[]; internalEdges: number; externalEdges: number }[];
  circularDeps: string[][];
}

// ─── Code Maps (generated during read phase for LLM traversal) ───

export interface CodeMaps {
  version: string;
  generatedAt: string;
  classMap: ClassMap;
  moduleMap: ModuleMap;
  callGraph: CallGraph;
  apiMap: APIMap;
}

export interface ClassMap {
  classes: ClassNode[];
  interfaces: InterfaceNode[];
  relationships: ClassRelationship[];
}

export interface ClassNode {
  id: string;
  name: string;
  file: string;
  line: number;
  extends: string | null;
  implements: string[];
  exported: boolean;
  methods: { name: string; visibility: string; params: string; returnType?: string }[];
  properties: { name: string; type?: string; visibility: string }[];
  description?: string;
}

export interface InterfaceNode {
  id: string;
  name: string;
  file: string;
  line: number;
  extends?: string[];
  exported: boolean;
  fields: { name: string; type: string; optional?: boolean }[];
  description?: string;
}

export type ClassRelationshipType = 'extends' | 'implements' | 'uses' | 'creates';

export interface ClassRelationship {
  from: string;
  to: string;
  type: ClassRelationshipType;
}

export interface ModuleMap {
  modules: ModuleNode[];
  connections: ModuleConnection[];
  layers: { name: string; modules: string[] }[];
}

export interface ModuleNode {
  id: string;
  path: string;
  fileCount: number;
  exports: string[];
  publicAPI: string[];
  responsibility?: string;
}

export interface ModuleConnection {
  from: string;
  to: string;
  imports: number;
  exportsUsed: string[];
}

export interface CallGraph {
  functions: CallNode[];
}

export interface CallNode {
  id: string;
  name: string;
  file: string;
  line: number;
  exported: boolean;
  calls: string[];
  calledBy: string[];
  description?: string;
}

export interface APIMap {
  endpoints: APIEndpoint[];
}

export interface APIEndpoint {
  method: string;
  path: string;
  file: string;
  handler: string;
  params?: string[];
  bodyShape?: string;
  responseShape?: string;
  description?: string;
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

// ─── Structured Widget Types ───

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

// The full context board - shared state for all agents
export interface ContextBoard {
  version: string;
  projectId: string;
  project: ProjectContext;
  agents: Record<AgentRole, AgentState>;
  entries: ContextEntry[];
  files: TrackedFile[];
  widgets: DashboardWidget[];
  phase: ProjectPhase;
  plan?: ProjectPlan;
  approval?: ApprovalState;
  createdAt: string;
  updatedAt: string;
}

// Log event for the observability dashboard
export interface WeaverEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  agent?: AgentRole;
  phase?: ProjectPhase;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}

// All agent roles as array for iteration
export const AGENT_ROLES: AgentRole[] = ['product-manager', 'architect', 'developer', 'qa', 'code-reviewer'];

// Project phases in order
export const PROJECT_PHASES: ProjectPhase[] = ['read', 'plan', 'ready'];

// Phase descriptions
export const PHASE_DESCRIPTIONS: Record<ProjectPhase, string> = {
  'read': 'Scan existing codebase and auto-detect project structure, tech stack, and patterns',
  'plan': 'Architect + PM brainstorm and create a plan with memory maps',
  'ready': 'Plan complete — ready for implementation',
};

// Agent display names
export const AGENT_DISPLAY_NAMES: Record<AgentRole, string> = {
  'product-manager': 'Product Manager',
  'architect': 'Architect',
  'developer': 'Developer',
  'qa': 'QA Engineer',
  'code-reviewer': 'Code Reviewer',
};

// ─── App Runner Types (process monitoring) ───

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  workspacePath: string;
  startedAt: string;
  status: 'running' | 'stopped' | 'crashed';
  exitCode?: number;
  recentLogs: AppLogLine[];
}

export interface AppLogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'stdout' | 'stderr';
  message: string;
  raw: string;
}

// ─── Documentation Collection Types ───

export type DocCategory = 'api' | 'architecture' | 'setup' | 'feature' | 'decision' | 'runbook' | 'changelog';

export const DOC_CATEGORIES: DocCategory[] = ['api', 'architecture', 'setup', 'feature', 'decision', 'runbook', 'changelog'];

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  api: 'API Documentation',
  architecture: 'Architecture',
  setup: 'Setup & Onboarding',
  feature: 'Feature Specs',
  decision: 'Decisions',
  runbook: 'Runbooks',
  changelog: 'Changelog',
};

export interface DocEntry {
  id: string;
  category: DocCategory;
  title: string;
  content: string;
  agent: AgentRole;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  revisions: { timestamp: string; agent: AgentRole }[];
}

export interface DocsCollection {
  version: string;
  docs: DocEntry[];
}

// ─── Approval Types ───

export type ApprovalStatus = 'pending' | 'approved' | 'changes-requested';

export interface ApprovalState {
  status: ApprovalStatus;
  reviewedAt?: string;
  reviewedBy: 'user' | AgentRole;
  comments?: string;
  revisionCount: number;
}
