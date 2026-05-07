import { buildToolRegistry } from '../../../src/tools/registry.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

describe('toolRegistry — initial scaffold (M3.2)', () => {
  it('includes check_cookie when cookie is present', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(),
      cookie: 'bid=x; dbcl2="1:y"',
      enableWrite: false,
    });
    expect(r.find(t => t.id === 'check_cookie')).toBeDefined();
  });

  it('omits check_cookie when no cookie', () => {
    const r = buildToolRegistry({
      dataSource: new FakeDataSource(),
      cookie: undefined,
      enableWrite: false,
    });
    expect(r.find(t => t.id === 'check_cookie')).toBeUndefined();
  });

  // FIXME(M3.6/7/8/4.3): re-enable once domain tools are implemented
  // it('includes 12 read tools regardless of cookie/write flags', () => {
  //   const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  //   for (const id of ['search_movie','get_movie','get_movie_reviews','get_movie_chart',
  //                     'search_book','get_book','get_book_reviews','get_book_chart',
  //                     'get_user_collections','get_user_doulist','get_user_profile']) {
  //     expect(r.find(t => t.id === id)).toBeDefined();
  //   }
  // });
  //
  // it('includes write tools only when enableWrite=true', () => {
  //   const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'x', enableWrite: true });
  //   for (const w of ['mark_movie','unmark_movie','mark_book','unmark_book']) {
  //     expect(r.find(t => t.id === w)).toBeDefined();
  //   }
  // });
});
