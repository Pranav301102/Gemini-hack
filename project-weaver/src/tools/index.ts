import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInitProject } from './init-project.js';
import { registerContextBoardTools } from './context-board.js';
import { registerAgentRunner } from './agent-runner.js';
import { registerPlanner } from './planner.js';
import { registerLogging } from './logging.js';
import { registerFileOps } from './file-ops.js';
import { registerReadProject } from './read-project.js';
import { registerIndexer } from './indexer.js';
import { registerEnrichment } from './enrichment.js';
import { registerDependencyGraph } from './dependency-graph.js';
import { registerCodeIntel } from './code-intel.js';
import { registerCodeMaps } from './code-maps.js';

export function registerAllTools(server: McpServer): void {
  registerInitProject(server);
  registerContextBoardTools(server);
  registerAgentRunner(server);
  registerPlanner(server);
  registerLogging(server);
  registerFileOps(server);
  registerReadProject(server);
  registerIndexer(server);
  registerEnrichment(server);
  registerDependencyGraph(server);
  registerCodeIntel(server);
  registerCodeMaps(server);
}
