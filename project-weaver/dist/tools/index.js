import { registerInitProject } from './init-project.js';
import { registerContextBoardTools } from './context-board.js';
import { registerAgentRunner } from './agent-runner.js';
import { registerPipeline } from './pipeline.js';
import { registerLogging } from './logging.js';
import { registerFileOps } from './file-ops.js';
import { registerApproval } from './approval.js';
import { registerReadProject } from './read-project.js';
import { registerIndexer } from './indexer.js';
import { registerEnrichment } from './enrichment.js';
import { registerDependencyGraph } from './dependency-graph.js';
import { registerCodeIntel } from './code-intel.js';
export function registerAllTools(server) {
    registerInitProject(server);
    registerContextBoardTools(server);
    registerAgentRunner(server);
    registerPipeline(server);
    registerLogging(server);
    registerFileOps(server);
    registerApproval(server);
    registerReadProject(server);
    registerIndexer(server);
    registerEnrichment(server);
    registerDependencyGraph(server);
    registerCodeIntel(server);
}
//# sourceMappingURL=index.js.map