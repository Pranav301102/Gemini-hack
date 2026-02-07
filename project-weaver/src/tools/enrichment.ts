import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';
import type { EnrichmentItem, FileIndex, ProjectIndex } from '../types.js';

/**
 * Extract a code snippet for a function/class/type/variable from the source file.
 * Reads from the item's line number and captures the relevant body.
 */
function extractCodeSnippet(
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
  const startIdx = Math.max(0, line - 1); // line is 1-based

  // Determine how many lines to capture based on kind
  const maxLines = kind === 'class' ? 50 : kind === 'function' ? 30 : kind === 'type' ? 20 : 5;
  const endIdx = Math.min(lines.length, startIdx + maxLines);

  const snippet = lines.slice(startIdx, endIdx).join('\n');
  // Cap at 2000 chars
  return snippet.length > 2000 ? snippet.substring(0, 1997) + '...' : snippet;
}

/**
 * Build a human-readable signature for a function.
 */
function buildFunctionSignature(fn: { name: string; params: { name: string; type?: string }[]; returnType?: string; isAsync?: boolean; isComponent?: boolean }): string {
  const async = fn.isAsync ? 'async ' : '';
  const component = fn.isComponent ? '[Component] ' : '';
  const params = fn.params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
  const ret = fn.returnType ? `: ${fn.returnType}` : '';
  return `${component}${async}${fn.name}(${params})${ret}`;
}

/**
 * Collect all un-enriched items from the index as EnrichmentItems.
 */
function collectUnenrichedItems(
  index: ProjectIndex,
  kindFilter?: string,
  fileFilter?: string,
  skipEnriched = true,
): { items: EnrichmentItem[]; totalItems: number; enrichedItems: number } {
  const items: EnrichmentItem[] = [];
  let totalItems = 0;
  let enrichedItems = 0;

  for (const file of index.files) {
    if (fileFilter && !file.path.includes(fileFilter)) continue;

    // Functions
    if (!kindFilter || kindFilter === 'function' || kindFilter === 'all') {
      for (const fn of file.functions) {
        totalItems++;
        if (fn.enrichedDescription) { enrichedItems++; if (skipEnriched) continue; }
        items.push({
          file: file.path,
          name: fn.name,
          kind: 'function',
          signature: buildFunctionSignature(fn),
          codeSnippet: '', // Will be filled with actual code
          existingDescription: fn.description,
          line: fn.line,
        });
      }
    }

    // Classes
    if (!kindFilter || kindFilter === 'class' || kindFilter === 'all') {
      for (const cls of file.classes) {
        totalItems++;
        if (cls.enrichedDescription) { enrichedItems++; if (skipEnriched) continue; }
        items.push({
          file: file.path,
          name: cls.name,
          kind: 'class',
          signature: `class ${cls.name}${cls.extends ? ' extends ' + cls.extends : ''}${cls.implements?.length ? ' implements ' + cls.implements.join(', ') : ''} { ${cls.methods.map(m => m.name).join(', ')} }`,
          codeSnippet: '',
          existingDescription: cls.description,
          line: cls.line,
        });
      }
    }

    // Types
    if (!kindFilter || kindFilter === 'type' || kindFilter === 'all') {
      for (const t of file.types) {
        totalItems++;
        if (t.enrichedDescription) { enrichedItems++; if (skipEnriched) continue; }
        const detail = t.fields ? `{ ${t.fields.map(f => f.name).join(', ')} }` : t.values ? t.values.join(' | ') : '';
        items.push({
          file: file.path,
          name: t.name,
          kind: 'type',
          signature: `${t.kind} ${t.name} ${detail}`,
          codeSnippet: '',
          existingDescription: t.description,
          line: 0, // Types don't track line in the current schema; use 0
        });
      }
    }

    // Variables
    if (!kindFilter || kindFilter === 'variable' || kindFilter === 'all') {
      for (const v of file.variables) {
        totalItems++;
        if (v.enrichedDescription) { enrichedItems++; if (skipEnriched) continue; }
        items.push({
          file: file.path,
          name: v.name,
          kind: 'variable',
          signature: `${v.kind} ${v.name}${v.type ? ': ' + v.type : ''}${v.value ? ' = ' + v.value : ''}`,
          codeSnippet: '',
          existingDescription: v.description,
          line: v.line,
        });
      }
    }
  }

  return { items, totalItems, enrichedItems };
}

export function registerEnrichment(server: McpServer): void {

  server.tool(
    'enrich_index',
    'Get a batch of un-enriched code items (functions, classes, types) with code snippets. Read each item and call save_enrichments with one-line descriptions. This is the core agent memory building step.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      batchSize: z.number().optional().describe('Items per batch (default: 15, max: 30)'),
      fileFilter: z.string().optional().describe('Only enrich items from files matching this path substring'),
      kind: z.enum(['function', 'class', 'type', 'variable', 'all']).optional().describe('Filter by item kind (default: all)'),
    },
    async ({ workspacePath, batchSize, fileFilter, kind }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const index = manager.readIndex();
      if (!index) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No index found. Run index_project first.' }) }],
        };
      }

      const size = Math.min(batchSize ?? 15, 30);
      const { items, totalItems, enrichedItems } = collectUnenrichedItems(index, kind, fileFilter);
      const remaining = items.length;

      if (remaining === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `All ${totalItems} items are already enriched!`,
              progress: { totalItems, enrichedItems, remaining: 0 },
            }),
          }],
        };
      }

      // Take a batch and fill in code snippets
      const batch = items.slice(0, size);
      for (const item of batch) {
        if (item.line > 0) {
          item.codeSnippet = extractCodeSnippet(index.rootPath, item.file, item.line, item.kind);
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            progress: { totalItems, enrichedItems, remaining },
            batchSize: batch.length,
            instruction: 'For each item below, write a concise one-line description of what it does. Optionally add a "purpose" field describing its role in the system. Then call save_enrichments with your descriptions. Format: [{file, name, kind, description, purpose?}]',
            batch,
          }),
        }],
      };
    },
  );

  server.tool(
    'save_enrichments',
    'Save LLM-generated descriptions back to the code index. Call after reading the batch from enrich_index.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      enrichments: z.array(z.object({
        file: z.string().describe('Relative file path'),
        name: z.string().describe('Function/class/type/variable name'),
        kind: z.enum(['function', 'class', 'type', 'variable', 'file']).describe('What kind of item'),
        description: z.string().describe('One-line description of what it does'),
        purpose: z.string().optional().describe('Role in the system (optional)'),
      })).describe('Array of enrichment results'),
    },
    async ({ workspacePath, enrichments }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const index = manager.readIndex();
      if (!index) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No index found.' }) }],
        };
      }

      let updated = 0;

      for (const enrichment of enrichments) {
        const file = index.files.find(f => f.path === enrichment.file);
        if (!file) continue;

        if (enrichment.kind === 'file') {
          file.enrichedDescription = enrichment.description;
          updated++;
          continue;
        }

        if (enrichment.kind === 'function') {
          const fn = file.functions.find(f => f.name === enrichment.name);
          if (fn) {
            fn.enrichedDescription = enrichment.description;
            if (enrichment.purpose) fn.purpose = enrichment.purpose;
            updated++;
          }
        } else if (enrichment.kind === 'class') {
          const cls = file.classes.find(c => c.name === enrichment.name);
          if (cls) {
            cls.enrichedDescription = enrichment.description;
            if (enrichment.purpose) cls.purpose = enrichment.purpose;
            updated++;
          }
        } else if (enrichment.kind === 'type') {
          const t = file.types.find(t => t.name === enrichment.name);
          if (t) {
            t.enrichedDescription = enrichment.description;
            updated++;
          }
        } else if (enrichment.kind === 'variable') {
          const v = file.variables.find(v => v.name === enrichment.name);
          if (v) {
            v.enrichedDescription = enrichment.description;
            updated++;
          }
        }
      }

      // Update enrichment progress
      let totalItems = 0;
      let enrichedItems = 0;
      for (const file of index.files) {
        for (const fn of file.functions) { totalItems++; if (fn.enrichedDescription) enrichedItems++; }
        for (const cls of file.classes) { totalItems++; if (cls.enrichedDescription) enrichedItems++; }
        for (const t of file.types) { totalItems++; if (t.enrichedDescription) enrichedItems++; }
        for (const v of file.variables) { totalItems++; if (v.enrichedDescription) enrichedItems++; }
      }

      index.enrichedAt = new Date().toISOString();
      index.enrichmentProgress = { totalItems, enrichedItems };
      manager.writeIndex(index);

      const remaining = totalItems - enrichedItems;

      manager.logEvent({
        level: 'info',
        agent: 'architect',
        stage: 'read',
        action: 'index_enriched',
        message: `Enriched ${updated} items (${enrichedItems}/${totalItems} total)`,
        data: { updated, totalItems, enrichedItems, remaining },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Saved ${updated} enrichments (${enrichedItems}/${totalItems} total)`,
            progress: { totalItems, enrichedItems, remaining },
            nextStep: remaining > 0
              ? 'Call enrich_index for the next batch'
              : 'Enrichment complete! The code index is now fully enriched with semantic descriptions.',
          }),
        }],
      };
    },
  );
}
