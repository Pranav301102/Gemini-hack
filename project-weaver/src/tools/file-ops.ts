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

  // --- track_file ---
  server.tool(
    'track_file',
    'Record a file in the context board without writing it. Use this when the file was already written by Gemini\'s native file tools — this just updates the Weaver tracking.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      filePath: z.string().describe('Relative file path from workspace root (e.g., "src/index.ts")'),
      agent: z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']).describe('Agent that wrote this file'),
      phase: z.enum(['read', 'plan', 'ready']).describe('Current project phase'),
      size: z.number().optional().describe('File size in bytes (optional)'),
    },
    async ({ workspacePath, filePath, agent, phase, size }) => {
      const manager = new BoardManager(workspacePath);
      if (!manager.exists()) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
        };
      }

      // Get actual file size if not provided
      let fileSize = size ?? 0;
      if (!size) {
        const resolved = path.resolve(workspacePath, filePath);
        try {
          const stat = fs.statSync(resolved);
          fileSize = stat.size;
        } catch {
          // File might not exist yet, that's ok
        }
      }

      manager.trackFile(filePath, agent, phase);
      manager.logEvent({
        level: 'info',
        agent,
        phase,
        action: 'file_tracked',
        message: `${agent} tracked file: ${filePath} (${fileSize} bytes)`,
        data: { filePath, size: fileSize },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `File tracked: ${filePath}`,
            filePath,
          }),
        }],
      };
    },
  );

  // --- read_file ---
  server.tool(
    'read_file',
    'Read the contents of a file from the workspace. Returns file content and metadata. Use this to inspect existing code before making changes.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      filePath: z.string().describe('Relative file path from workspace root (e.g., "src/index.ts")'),
      startLine: z.number().optional().describe('Start reading from this line (1-based, inclusive)'),
      endLine: z.number().optional().describe('Stop reading at this line (1-based, inclusive)'),
    },
    async ({ workspacePath, filePath, startLine, endLine }) => {
      // Prevent path traversal
      const resolved = path.resolve(workspacePath, filePath);
      if (!resolved.startsWith(path.resolve(workspacePath))) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Path traversal not allowed.' }) }],
        };
      }

      if (!fs.existsSync(resolved)) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `File not found: ${filePath}` }) }],
        };
      }

      try {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `Path is a directory, not a file: ${filePath}` }) }],
          };
        }

        const raw = fs.readFileSync(resolved, 'utf-8');
        let content = raw;
        let totalLines = raw.split('\n').length;

        // Apply line range if specified
        if (startLine !== undefined || endLine !== undefined) {
          const lines = raw.split('\n');
          const start = Math.max(1, startLine ?? 1) - 1;
          const end = Math.min(lines.length, endLine ?? lines.length);
          content = lines.slice(start, end).join('\n');
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              filePath,
              size: stat.size,
              totalLines,
              content,
              ...(startLine || endLine ? { lineRange: { start: startLine ?? 1, end: endLine ?? totalLines } } : {}),
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}` }) }],
        };
      }
    },
  );

  // --- delete_file ---
  server.tool(
    'delete_file',
    'Delete a file from the workspace and remove it from tracking. Use this when a file is no longer needed (e.g., during refactoring).',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      filePath: z.string().describe('Relative file path from workspace root (e.g., "src/old-file.ts")'),
      agent: z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']).describe('Agent deleting this file'),
      phase: z.enum(['read', 'plan', 'ready']).describe('Current project phase'),
    },
    async ({ workspacePath, filePath, agent, phase }) => {
      // Prevent path traversal
      const resolved = path.resolve(workspacePath, filePath);
      if (!resolved.startsWith(path.resolve(workspacePath))) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'Path traversal not allowed.' }) }],
        };
      }

      if (!fs.existsSync(resolved)) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `File not found: ${filePath}` }) }],
        };
      }

      try {
        fs.unlinkSync(resolved);

        // Remove from tracking
        const manager = new BoardManager(workspacePath);
        if (manager.exists()) {
          const board = manager.readBoard();
          board.files = board.files.filter(f => f.path !== filePath);
          manager.writeBoard(board);

          manager.logEvent({
            level: 'info',
            agent,
            phase,
            action: 'file_deleted',
            message: `${agent} deleted file: ${filePath}`,
            data: { filePath },
          });
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, message: `File deleted: ${filePath}`, filePath }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `Error deleting file: ${err instanceof Error ? err.message : 'Unknown error'}` }) }],
        };
      }
    },
  );

  // --- list_files ---
  server.tool(
    'list_project_files',
    'List all files tracked by Agent Weaver that agents have created.',
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
