import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function linkClient(server: McpServer): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(c), server.server.connect(s)]);
  return client;
}
