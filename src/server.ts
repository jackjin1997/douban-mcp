import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorBoundary } from './tools/_boundary.js';
import { buildToolRegistry, type RegistryOpts } from './tools/registry.js';
import { VERSION } from './version.js';

export function buildServer(opts: RegistryOpts): McpServer {
  const server = new McpServer({ name: 'douban-mcp', version: VERSION });
  const registry = buildToolRegistry(opts);
  for (const tool of registry) {
    server.registerTool(
      tool.mcpName,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,  // 从 ZodObject 取 raw shape 喂给 SDK
        annotations: tool.annotations,
      },
      withErrorBoundary(async (args: any) => tool.handler(tool.inputSchema.parse(args))) as any,
    );
  }
  return server;
}
