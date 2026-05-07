import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorBoundary } from './tools/_boundary.js';
import { buildToolRegistry, type RegistryOpts } from './tools/registry.js';

export function buildServer(opts: RegistryOpts): McpServer {
  const server = new McpServer({ name: 'douban-mcp', version: '1.0.0-alpha.0' });
  const registry = buildToolRegistry(opts);
  for (const tool of registry) {
    server.registerTool(
      tool.mcpName,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,  // 从 ZodObject 取 raw shape 喂给 SDK
        annotations: tool.annotations,
      },
      withErrorBoundary(tool.handler) as any,
    );
  }
  return server;
}
