import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

async function makeClient() {
  return linkClient(buildServer({
    dataSource: new FakeDataSource(),
    cookie: undefined,
    enableWrite: false,
  }));
}

it('search_book returns markdown', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'search_book', arguments: { q: '三体', count: 2 } });
  expect(r.content[0].text).toContain('三体 0');
});

it('search_book rejects empty q', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'search_book', arguments: { q: '' } });
  expect(r.isError).toBe(true);
});

it('get_book returns detail', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_book', arguments: { id: '999' } });
  expect(r.content[0].text).toContain('Book 999');
  expect(r.content[0].text).toContain('Author');
});

it('get_book_reviews returns list', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_book_reviews', arguments: { id: '1', count: 2 } });
  expect(r.content[0].text).toMatch(/reader0/);
});

it('get_book_chart returns markdown list', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_book_chart', arguments: { kind: 'fiction', count: 2 } });
  expect(r.content[0].text).toContain('Book Chart 0');
});
