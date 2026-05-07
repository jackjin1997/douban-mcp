import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'douban-mcp', version: '1.0.0-alpha.0' });

  server.registerTool(
    'hello',
    {
      description: 'Smoke-test tool for the douban-mcp server skeleton',
      inputSchema: { who: z.string().default('world') },
      annotations: { readOnlyHint: true },
    },
    async ({ who }) => ({ content: [{ type: 'text', text: `Hello, ${who}!` }] }),
  );

  return server;
}
