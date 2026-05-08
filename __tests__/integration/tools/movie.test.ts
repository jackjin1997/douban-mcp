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

it('search_movie returns markdown listing', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'search_movie', arguments: { q: '盗梦', count: 3 } });
  const text = r.content[0].text;
  expect(text).toContain('盗梦 0');
  expect(text).toMatch(/movie\.douban\.com\/subject\/m0/);
});

it('search_movie rejects empty q', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'search_movie', arguments: { q: '' } });
  expect(r.isError).toBe(true);
});

it('get_movie returns detail markdown', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_movie', arguments: { id: '1234' } });
  expect(r.content[0].text).toContain('Movie 1234');
});

it('get_movie_reviews returns numbered list', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_movie_reviews', arguments: { id: '1', count: 2 } });
  expect(r.content[0].text).toMatch(/1\.\s+\*\*user0\*\*/);
});

it('get_movie_chart with kind=top250 returns markdown list', async () => {
  const c = await makeClient();
  const r: any = await c.callTool({ name: 'get_movie_chart', arguments: { kind: 'top250', count: 2 } });
  expect(r.content[0].text).toContain('Chart 0');
});
