import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';
const server = new McpServer({
    name: 'project-weaver',
    version: '1.0.0',
});
// Register all MCP tools
registerAllTools(server);
// Connect via stdio - IMPORTANT: never write to stdout directly, use stderr for logging
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map