import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';

describe('server bootstrap (registry-driven)', () => {
  it('registers check_cookie when cookie provided', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
    const client = await linkClient(server);
    const list = await client.listTools();
    expect(list.tools.find(t => t.name === 'check_cookie')).toBeDefined();
  });

  it('does not register check_cookie when no cookie', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    const client = await linkClient(server);
    // 当 cookie 未提供时，meta 工具不注册；若此时其他工具也未注册，
    // McpServer 不声明 tools capability → listTools 抛 Method not found，
    // 这与 check_cookie 不存在语义等价。
    const tools = await client.listTools().then(r => r.tools).catch(() => []);
    expect(tools.find(t => t.name === 'check_cookie')).toBeUndefined();
  });

  it('check_cookie returns markdown text containing user name', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
    const client = await linkClient(server);
    const r = await client.callTool({ name: 'check_cookie', arguments: {} });
    expect(((r as any).content[0]).text).toContain('TestUser');
  });

  it('check_cookie reports invalid when getCurrentUser returns null', async () => {
    const ds = new FakeDataSource();
    ds.getCurrentUser = jest.fn(async () => null) as any;
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
    const client = await linkClient(server);
    const r = await client.callTool({ name: 'check_cookie', arguments: {} });
    expect(((r as any).content[0]).text).toContain('cookie 已失效');
  });
});
