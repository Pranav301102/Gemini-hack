import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_OUTPUT_SIZE = 100_000; // 100KB max output

export function registerShell(server: McpServer): void {

  // --- run_command ---
  server.tool(
    'run_command',
    'Run a shell command in the workspace directory and capture its output. Use this for running tests, builds, linters, or any CLI tool. Has a timeout to prevent hanging.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      command: z.string().describe('The shell command to run (e.g., "npm test", "npx tsc --noEmit", "ls -la src/")'),
      timeoutMs: z.number().optional().describe('Timeout in milliseconds (default: 30000). Max: 120000.'),
      agent: z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']).optional().describe('Agent running this command (for logging)'),
      phase: z.enum(['read', 'plan', 'ready']).optional().describe('Current project phase (for logging)'),
    },
    async ({ workspacePath, command, timeoutMs, agent, phase }) => {
      const timeout = Math.min(timeoutMs ?? DEFAULT_TIMEOUT_MS, 120_000);

      const manager = new BoardManager(workspacePath);

      // Log the command execution
      if (manager.exists() && agent) {
        manager.logEvent({
          level: 'info',
          agent,
          phase,
          action: 'command_started',
          message: `${agent} running: ${command}`,
          data: { command, timeout },
        });
      }

      try {
        const result = await executeCommand(command, workspacePath, timeout);

        // Log the result
        if (manager.exists() && agent) {
          manager.logEvent({
            level: result.exitCode === 0 ? 'info' : 'warn',
            agent,
            phase,
            action: 'command_completed',
            message: `Command ${result.exitCode === 0 ? 'succeeded' : 'failed'} (exit ${result.exitCode}): ${command}`,
            data: {
              command,
              exitCode: result.exitCode,
              durationMs: result.durationMs,
              stdoutLines: result.stdout.split('\n').length,
              stderrLines: result.stderr.split('\n').length,
            },
          });
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              exitCode: result.exitCode,
              stdout: truncateOutput(result.stdout),
              stderr: truncateOutput(result.stderr),
              durationMs: result.durationMs,
              timedOut: result.timedOut,
            }),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (manager.exists() && agent) {
          manager.logEvent({
            level: 'error',
            agent,
            phase,
            action: 'command_failed',
            message: `Command execution error: ${message}`,
            data: { command },
          });
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, message: `Command execution error: ${message}` }),
          }],
        };
      }
    },
  );
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

function executeCommand(command: string, cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let resolved = false;

    const child = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= MAX_OUTPUT_SIZE) {
        stdout += chunk;
      } else if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += chunk.substring(0, MAX_OUTPUT_SIZE - stdout.length);
        stdout += '\n... [output truncated at 100KB]';
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= MAX_OUTPUT_SIZE) {
        stderr += chunk;
      } else if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += chunk.substring(0, MAX_OUTPUT_SIZE - stderr.length);
        stderr += '\n... [output truncated at 100KB]';
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!resolved) {
          child.kill('SIGKILL');
        }
      }, 3000);
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolved = true;
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolved = true;
      resolve({
        exitCode: 1,
        stdout,
        stderr: err.message,
        durationMs: Date.now() - startTime,
        timedOut: false,
      });
    });
  });
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_SIZE) {
    return output.substring(0, MAX_OUTPUT_SIZE) + '\n... [truncated]';
  }
  return output;
}
