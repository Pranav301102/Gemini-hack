import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectIndex, FileIndex, EnrichmentItem } from './types';

export function readProjectIndex(projectPath: string): ProjectIndex | null {
  const indexPath = path.join(projectPath, '.weaver', 'index.json');
  try {
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw) as ProjectIndex;
  } catch {
    return null;
  }
}

export function writeProjectIndex(projectPath: string, index: ProjectIndex): void {
  const indexPath = path.join(projectPath, '.weaver', 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

function buildFunctionSignature(fn: { name: string; params: { name: string; type?: string }[]; returnType?: string; isAsync?: boolean; isComponent?: boolean }): string {
  const async = fn.isAsync ? 'async ' : '';
  const component = fn.isComponent ? '[Component] ' : '';
  const params = fn.params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
  const ret = fn.returnType ? `: ${fn.returnType}` : '';
  return `${component}${async}${fn.name}(${params})${ret}`;
}

export function collectUnenrichedItems(
  index: ProjectIndex,
  batchSize: number,
  fileFilter?: string,
  kindFilter?: string,
): { batch: EnrichmentItem[]; totalItems: number; enrichedItems: number; remaining: number } {
  const items: EnrichmentItem[] = [];
  let totalItems = 0;
  let enrichedItems = 0;

  for (const file of index.files) {
    if (fileFilter && !file.path.includes(fileFilter)) continue;

    for (const fn of file.functions) {
      totalItems++;
      if (fn.enrichedDescription) { enrichedItems++; continue; }
      if (kindFilter && kindFilter !== 'function') continue;
      items.push({
        file: file.path, name: fn.name, kind: 'function',
        signature: buildFunctionSignature(fn),
        codeSnippet: '', existingDescription: fn.description, line: fn.line,
      });
    }

    for (const cls of file.classes) {
      totalItems++;
      if (cls.enrichedDescription) { enrichedItems++; continue; }
      if (kindFilter && kindFilter !== 'class') continue;
      items.push({
        file: file.path, name: cls.name, kind: 'class',
        signature: `class ${cls.name}${cls.extends ? ' extends ' + cls.extends : ''} { ${cls.methods.map(m => m.name).join(', ')} }`,
        codeSnippet: '', existingDescription: cls.description, line: cls.line,
      });
    }

    for (const t of file.types) {
      totalItems++;
      if (t.enrichedDescription) { enrichedItems++; continue; }
      if (kindFilter && kindFilter !== 'type') continue;
      const detail = t.fields ? `{ ${t.fields.map(f => f.name).join(', ')} }` : t.values ? t.values.join(' | ') : '';
      items.push({
        file: file.path, name: t.name, kind: 'type',
        signature: `${t.kind} ${t.name} ${detail}`,
        codeSnippet: '', existingDescription: t.description, line: 0,
      });
    }

    for (const v of file.variables) {
      totalItems++;
      if (v.enrichedDescription) { enrichedItems++; continue; }
      if (kindFilter && kindFilter !== 'variable') continue;
      items.push({
        file: file.path, name: v.name, kind: 'variable',
        signature: `${v.kind} ${v.name}${v.type ? ': ' + v.type : ''}${v.value ? ' = ' + v.value : ''}`,
        codeSnippet: '', existingDescription: v.description, line: v.line,
      });
    }
  }

  const batch = items.slice(0, batchSize);
  const remaining = items.length - batch.length;
  return { batch, totalItems, enrichedItems, remaining };
}

export function extractCodeSnippet(
  rootPath: string,
  filePath: string,
  line: number,
  kind: 'function' | 'class' | 'type' | 'variable',
): string {
  const fullPath = path.join(rootPath, filePath);
  let content: string;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return '(source file not readable)';
  }

  const lines = content.split('\n');
  const startIdx = Math.max(0, line - 1);
  const maxLines = kind === 'class' ? 50 : kind === 'function' ? 30 : kind === 'type' ? 20 : 5;
  const endIdx = Math.min(lines.length, startIdx + maxLines);
  const snippet = lines.slice(startIdx, endIdx).join('\n');
  return snippet.length > 2000 ? snippet.substring(0, 1997) + '...' : snippet;
}

export function buildContextSummary(index: ProjectIndex): string {
  const parts: string[] = [];

  parts.push(`# Project Codebase Summary`);
  parts.push(`Tech Stack: ${index.techStack.join(', ')}`);
  parts.push(`Files: ${index.totalFiles} | Functions: ${index.totalFunctions} | Classes: ${index.totalClasses} | Types: ${index.totalTypes}`);
  parts.push('');

  // File summaries
  parts.push('## Key Files');
  for (const file of index.files.slice(0, 40)) {
    const desc = file.enrichedDescription || file.description || '';
    parts.push(`- **${file.path}** (${file.language}): ${desc}`);
  }
  parts.push('');

  // Top functions/classes with descriptions
  parts.push('## Key Functions & Classes');
  let itemCount = 0;
  for (const file of index.files) {
    for (const fn of file.functions) {
      if (itemCount >= 60) break;
      if (fn.enrichedDescription) {
        parts.push(`- \`${file.path}::${fn.name}\`: ${fn.enrichedDescription}`);
        itemCount++;
      }
    }
    for (const cls of file.classes) {
      if (itemCount >= 60) break;
      if (cls.enrichedDescription) {
        parts.push(`- \`${file.path}::${cls.name}\` (class): ${cls.enrichedDescription}`);
        itemCount++;
      }
    }
    if (itemCount >= 60) break;
  }
  parts.push('');

  // Dependency graph summary
  if (index.dependencyGraph) {
    const dg = index.dependencyGraph;
    parts.push('## Architecture');
    if (dg.entryPoints.length > 0) {
      parts.push(`Entry Points: ${dg.entryPoints.slice(0, 10).join(', ')}`);
    }
    if (dg.sharedModules.length > 0) {
      parts.push(`Shared Modules: ${dg.sharedModules.slice(0, 10).map(m => `${m.file} (${m.importedBy} importers)`).join(', ')}`);
    }
    if (dg.circularDeps.length > 0) {
      parts.push(`Circular Dependencies: ${dg.circularDeps.length} cycles detected`);
    }
  }

  return parts.join('\n');
}
