// Types copied from MCP server src/types.ts for dashboard use
// Only the subset needed for Gemini API features

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
}

export interface EnrichmentItem {
  file: string;
  name: string;
  kind: 'function' | 'class' | 'type' | 'variable';
  signature: string;
  codeSnippet: string;
  existingDescription?: string;
  line: number;
}

// Dashboard-specific types

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ApprovalReview {
  issues: { severity: 'high' | 'medium' | 'low'; title: string; description: string }[];
  gaps: { area: string; description: string; recommendation: string }[];
  recommendations: { category: string; title: string; description: string; priority: string }[];
  overallAssessment: string;
  readinessScore: number;
}
