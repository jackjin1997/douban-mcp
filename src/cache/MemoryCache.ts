import NodeCache from 'node-cache';

export class MemoryCache {
  private store = new NodeCache({ checkperiod: 60 });
  private get disabled() { return process.env.DOUBAN_DISABLE_CACHE === 'true'; }

  has(key: string): boolean { return !this.disabled && this.store.has(key); }

  async wrap<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
    if (this.disabled) return fetcher();
    const hit = this.store.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fetcher();
    this.store.set(key, value, ttlSec);
    return value;
  }

  invalidate(keyPrefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(keyPrefix)) this.store.del(k);
    }
  }
}
