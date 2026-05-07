import { HtmlDataSource } from './HtmlDataSource.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import type { IDoubanDataSource } from './types.js';

export interface FactoryOpts {
  kind?: 'html' | 'frodo';
  cookie?: string;
  cache?: MemoryCache;
  rateLimiter?: DomainLimiter;
}

export function createDataSource(opts: FactoryOpts = {}): IDoubanDataSource {
  const kind = opts.kind ?? (process.env.DOUBAN_DATA_SOURCE as 'html' | 'frodo' | undefined) ?? 'html';
  const cache = opts.cache ?? new MemoryCache();
  const rateLimiter = opts.rateLimiter ?? new DomainLimiter({ readPerSec: 1, writePerSec: 1 / 3, cooldownSec: 60 });
  if (kind === 'html') return new HtmlDataSource({ cookie: opts.cookie, cache, rateLimiter });
  if (kind === 'frodo') throw new Error('FrodoDataSource lands in M6 — set DOUBAN_DATA_SOURCE=html');
  throw new Error(`Unknown DOUBAN_DATA_SOURCE=${kind}`);
}
