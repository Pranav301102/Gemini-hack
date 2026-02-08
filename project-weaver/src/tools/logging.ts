import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BoardManager } from '../context/board.js';

export function registerLogging(server: McpServer): void {

  server.tool(
    'log_event',
    'Log an event to .weaver/logs/ for the observability dashboard. Events are JSONL (one JSON per line) in date-stamped files.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      level: z.enum(['info', 'warn', 'error', 'debug']).describe('Log level'),
      agent: z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']).optional().describe('Agent that generated this event'),
      phase: z.enum(['read', 'plan', 'ready']).optional().describe('Project phase'),
      action: z.string().describe('Action identifier (e.g., "code_generated", "test_failed", "review_complete")'),
      message: z.string().describe('Human-readable event description'),
      data: z.record(z.unknown()).optional().describe('Additional structured data'),
    },
    async ({ workspacePath, level, agent, phase, action, message, data }) => {
      const manager = new BoardManager(workspacePath);
      manager.logEvent({ level, agent, phase, action, message, data });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, message: 'Event logged to .weaver/logs/' }),
        }],
      };
    },
  );

  server.tool(
    'read_logs',
    'Read log events from the .weaver/logs/ directory. Useful for debugging and reviewing agent activity.',
    {
      workspacePath: z.string().describe('Absolute path to the workspace directory'),
      date: z.string().optional().describe('Date to read logs for (YYYY-MM-DD format). Defaults to today.'),
      limit: z.number().optional().describe('Maximum number of events to return (default: all)'),
    },
    async ({ workspacePath, date, limit }) => {
      const manager = new BoardManager(workspacePath);
      const events = manager.readLogs(date);
      const limited = limit ? events.slice(-limit) : events;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            date: date ?? new Date().toISOString().split('T')[0],
            totalEvents: events.length,
            returnedEvents: limited.length,
            events: limited,
          }),
        }],
      };
    },
  );
}
