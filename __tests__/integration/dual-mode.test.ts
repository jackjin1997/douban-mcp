import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';

describe('dual-mode startup invariants', () => {
  it('anonymous mode: 11 read tools, no check_cookie or mark_*', async () => {
    const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false }));
    const names = (await c.listTools()).tools.map(t => t.name);
    expect(names.length).toBe(11);
    expect(names).not.toContain('check_cookie');
    expect(names.filter(n => n.startsWith('mark_') || n.startsWith('unmark_'))).toEqual([]);
    expect(names).toContain('search_movie');
    expect(names).toContain('search_book');
    expect(names).toContain('get_user_collections');
  });

  it('logged-in read-only: 12 tools (incl check_cookie), no writes', async () => {
    const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false }));
    const names = (await c.listTools()).tools.map(t => t.name);
    expect(names.length).toBe(12);
    expect(names).toContain('check_cookie');
    expect(names.filter(n => n.startsWith('mark_') || n.startsWith('unmark_'))).toEqual([]);
  });

  it('logged-in write: 16 tools total', async () => {
    const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: true }));
    const names = (await c.listTools()).tools.map(t => t.name);
    expect(names.length).toBe(16);
    for (const n of ['check_cookie', 'mark_movie', 'unmark_movie', 'mark_book', 'unmark_book']) {
      expect(names).toContain(n);
    }
  });
});
