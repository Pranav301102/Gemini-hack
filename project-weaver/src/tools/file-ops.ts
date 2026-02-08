import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';

export function registerFileOps(server: McpServer): void {

  // --- save_file ---
  server.tool(
    'save_file',
    'Write a code file to the workspace. Used by agents to create actual project files. Records the file in the context board for tracking.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      filePath: z.string().describe('Relative file path from workspace root (e.g., "src/index.ts", "tests/app.test.ts")'),
      content: z.string().describe('Complete file content to write'),
      agent: z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']).describe('Agent writing this file'),
      phase: z.enum(['read', 'plan', 'ready']).describe('Current project phase'),
    },
    async ({ workspacePath, filePath, content, agent, phase }) => {
      const manager = new BoardManager(workspacePath);

      // Prevent path traversal
      const resolved = path.resolve(workspacePath, filePath);
      if (!resolved.startsWith(path.resolve(workspacePath))) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Path traversal not allowed.' }) }],
        };
      }

      // Create directories and write file
      const dir = path.dirname(resolved);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, content, 'utf-8');

      // Track the file in context board
      if (manager.exists()) {
        manager.trackFile(filePath, agent, phase);
        manager.logEvent({
          level: 'info',
          agent,
          phase,
          action: 'file_created',
          message: `${agent} wrote file: ${filePath} (${content.length} bytes)`,
          data: { filePath, size: content.length },
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `File written: ${filePath} (${content.length} bytes)`,
            filePath,
            absolutePath: resolved,
          }),
        }],
      };
    },
  );

  // --- list_files ---
  server.tool(
    'list_project_files',
    'List all files tracked by Project Weaver that agents have created.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
    },
    async ({ workspacePath }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      const board = manager.readBoard();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            files: board.files,
            totalFiles: board.files.length,
          }),
        }],
      };
    },
  );
}
