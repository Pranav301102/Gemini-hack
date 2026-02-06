import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInitProject } from './init-project.js';
import { registerContextBoardTools } from './context-board.js';
import { registerAgentRunner } from './agent-runner.js';
import { registerPipeline } from './pipeline.js';
import { registerLogging } from './logging.js';
import { registerFileOps } from './file-ops.js';

export function registerAllTools(server: McpServer): void {
  registerInitProject(server);
  registerContextBoardTools(server);
  registerAgentRunner(server);
  registerPipeline(server);
  registerLogging(server);
  registerFileOps(server);
}
