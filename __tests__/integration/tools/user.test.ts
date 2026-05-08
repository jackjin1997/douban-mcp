import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';
import { AuthError } from '../../../src/errors.js';

it('get_user_profile returns profile markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r: any = await client.callTool({ name: 'get_user_profile', arguments: { uid: '42' } });
  expect(r.content[0].text).toContain('TestUser');
});

it('get_user_collections without uid and without cookie surfaces error', async () => {
  const ds = new FakeDataSource();
  ds.getUserCollections = jest.fn(async (uid: string | null) => {
    if (!uid) throw new AuthError('uid is null and no cookie');
    return [];
  }) as any;
  const server = buildServer({ dataSource: ds, cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  // anonymous mode → schema requires uid → calling without uid should error at zod validation
  const r: any = await client.callTool({ name: 'get_user_collections', arguments: { category: 'movie', status: 'collect' } });
  expect(r.isError).toBe(true);
});

it('get_user_collections with uid returns markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r: any = await client.callTool({
    name: 'get_user_collections',
    arguments: { uid: '42', category: 'movie', status: 'collect', count: 2 },
  });
  expect(r.content[0].text).toContain('Subject 0');
});

it('get_user_doulist returns markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r: any = await client.callTool({ name: 'get_user_doulist', arguments: { uid: '42' } });
  expect(r.content[0].text).toContain('List 1');
});

it('with cookie, get_user_profile uid optional', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
  const client = await linkClient(server);
  const r: any = await client.callTool({ name: 'get_user_profile', arguments: {} });
  expect(r.content[0].text).toContain('TestUser');
});
