import { buildToolRegistry } from '../../../src/tools/registry.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

const ALL_READ_IDS = [
  'search_movie', 'get_movie', 'get_movie_reviews', 'get_movie_chart',
  'search_book', 'get_book', 'get_book_reviews', 'get_book_chart',
  'get_user_collections', 'get_user_doulist', 'get_user_profile',
];

describe('toolRegistry', () => {
  it('always includes 11 read tools regardless of cookie/write flags', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(),
      cookie: undefined,
      enableWrite: false,
    });
    for (const id of ALL_READ_IDS) {
      expect(r.find(t => t.id === id)).toBeDefined();
    }
  });

  it('includes check_cookie only when cookie is present', () => {
    const noCookie = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false,
    });
    expect(noCookie.find(t => t.id === 'check_cookie')).toBeUndefined();

    const withCookie = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false,
    });
    expect(withCookie.find(t => t.id === 'check_cookie')).toBeDefined();
  });

  it('every read tool has annotations.readOnlyHint=true', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false,
    });
    for (const t of r) {
      if (t.readOnly) {
        expect(t.annotations?.readOnlyHint).toBe(true);
        expect(t.annotations?.destructiveHint).not.toBe(true);
      }
    }
  });

  it('CLI names are unique kebab-case', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false,
    });
    const names = r.map(t => t.cliName);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('MCP names are unique snake_case', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false,
    });
    const names = r.map(t => t.mcpName);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('inputSchema is a ZodObject with .shape accessible', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false,
    });
    for (const t of r) {
      expect(t.inputSchema).toBeDefined();
      expect(t.inputSchema.shape).toBeDefined();
    }
  });
});
