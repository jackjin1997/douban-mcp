import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';

describe('MCP server skeleton', () => {
  it('exposes a hello tool and returns greeting', async () => {
    const server = buildServer();
    const client = await linkClient(server);
    const list = await client.listTools();
    expect(list.tools.map(t => t.name)).toContain('hello');
    const res = await client.callTool({ name: 'hello', arguments: { who: 'douban' } }) as any;
    const text = res.content[0].text;
    expect(text).toContain('Hello, douban');
  });
});
