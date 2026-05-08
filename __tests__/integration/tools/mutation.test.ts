import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

describe('mutation tools', () => {
  it('mark_movie records call on dataSource with normalized options', async () => {
    const ds = new FakeDataSource();
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    const r: any = await client.callTool({
      name: 'mark_movie',
      arguments: { id: '1234', status: 'collect', rating: 5, comment: 'great' },
    });
    expect(r.content[0].text).toContain('已标记');
    expect(r.content[0].text).toContain('电影');
    expect(ds.marks).toEqual([{
      category: 'movie',
      id: '1234',
      status: 'collect',
      options: { rating: 5, comment: 'great', shareToFeed: false },
    }]);
  });

  it('mark_book records call', async () => {
    const ds = new FakeDataSource();
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    await client.callTool({
      name: 'mark_book',
      arguments: { id: '999', status: 'wish', tags: ['ai', 'classic'] },
    });
    expect(ds.marks[0].category).toBe('book');
    expect(ds.marks[0].options.tags).toEqual(['ai', 'classic']);
  });

  it('unmark_book records call', async () => {
    const ds = new FakeDataSource();
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    await client.callTool({ name: 'unmark_book', arguments: { id: '999' } });
    expect(ds.unmarks).toEqual([{ category: 'book', id: '999' }]);
  });

  it('write tools NOT registered when enableWrite=false', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
    const client = await linkClient(server);
    const list = await client.listTools();
    for (const w of ['mark_movie', 'unmark_movie', 'mark_book', 'unmark_book']) {
      expect(list.tools.find(t => t.name === w)).toBeUndefined();
    }
  });

  it('mark tools have destructiveHint=true (not readOnlyHint)', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    const list = await client.listTools();
    const m = list.tools.find(t => t.name === 'mark_movie');
    expect(m?.annotations?.destructiveHint).toBe(true);
    expect(m?.annotations?.readOnlyHint).not.toBe(true);
  });

  it('rejects rating > 5 (zod validation)', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    const r: any = await client.callTool({
      name: 'mark_movie',
      arguments: { id: '1', status: 'collect', rating: 6 },
    });
    expect(r.isError).toBe(true);
  });
});
