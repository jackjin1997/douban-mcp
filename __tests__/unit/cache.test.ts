import { MemoryCache } from '../../src/cache/MemoryCache.js';

describe('MemoryCache', () => {
  it('returns cached value on second call', async () => {
    const cache = new MemoryCache();
    let calls = 0;
    const fetch = async () => { calls++; return 'value'; };
    const v1 = await cache.wrap('k', 60, fetch);
    const v2 = await cache.wrap('k', 60, fetch);
    expect(v1).toBe('value');
    expect(v2).toBe('value');
    expect(calls).toBe(1);
  });

  it('invalidate(prefix) removes matching keys', async () => {
    const cache = new MemoryCache();
    await cache.wrap('user:42:movie', 60, async () => 'a');
    await cache.wrap('user:42:book',  60, async () => 'b');
    await cache.wrap('search:foo',    60, async () => 'c');
    cache.invalidate('user:42:');
    expect(cache.has('user:42:movie')).toBe(false);
    expect(cache.has('user:42:book')).toBe(false);
    expect(cache.has('search:foo')).toBe(true);
  });

  it('respects DOUBAN_DISABLE_CACHE', async () => {
    process.env.DOUBAN_DISABLE_CACHE = 'true';
    const cache = new MemoryCache();
    let calls = 0;
    await cache.wrap('k', 60, async () => { calls++; return 'v'; });
    await cache.wrap('k', 60, async () => { calls++; return 'v'; });
    expect(calls).toBe(2);
    delete process.env.DOUBAN_DISABLE_CACHE;
  });
});
