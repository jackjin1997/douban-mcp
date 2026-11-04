import { HtmlDataSource } from './HtmlDataSource.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import type { IDoubanDataSource } from './types.js';
import { AuthError } from '../errors.js';

export const FRODO_UNAVAILABLE_MESSAGE =
  'Frodo API 数据源已移除：豆瓣要求对 Frodo 请求签名，签名算法未公开，该通道从未对真实请求可用。请去掉 DOUBAN_DATA_SOURCE=frodo，使用默认的 html 模式。';

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
  // 'frodo' stays a recognised value so old configs fail with a clear message instead of "Unknown DOUBAN_DATA_SOURCE".
  if (kind === 'frodo') throw new AuthError(FRODO_UNAVAILABLE_MESSAGE);
  throw new Error(`Unknown DOUBAN_DATA_SOURCE=${kind}`);
}
