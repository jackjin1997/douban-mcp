import { HtmlDataSource } from './HtmlDataSource.js';
import { FrodoDataSource } from './FrodoDataSource.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import type { IDoubanDataSource } from './types.js';
import { AuthError } from '../errors.js';

export const FRODO_UNAVAILABLE_MESSAGE =
  'Frodo API 现在要求请求签名（v1.0 不支持）。请改用默认 DOUBAN_DATA_SOURCE=html 模式；如需继续开发/测试 Frodo，请显式设置 DOUBAN_EXPERIMENTAL_FRODO=true。';

export interface FactoryOpts {
  kind?: 'html' | 'frodo';
  cookie?: string;
  cache?: MemoryCache;
  rateLimiter?: DomainLimiter;
  allowExperimentalFrodo?: boolean;
}

export function createDataSource(opts: FactoryOpts = {}): IDoubanDataSource {
  const kind = opts.kind ?? (process.env.DOUBAN_DATA_SOURCE as 'html' | 'frodo' | undefined) ?? 'html';
  const cache = opts.cache ?? new MemoryCache();
  const rateLimiter = opts.rateLimiter ?? new DomainLimiter({ readPerSec: 1, writePerSec: 1 / 3, cooldownSec: 60 });
  if (kind === 'html') return new HtmlDataSource({ cookie: opts.cookie, cache, rateLimiter });
  if (kind === 'frodo') {
    const allowFrodo = opts.allowExperimentalFrodo ?? process.env.DOUBAN_EXPERIMENTAL_FRODO === 'true';
    if (!allowFrodo) throw new AuthError(FRODO_UNAVAILABLE_MESSAGE);
    return new FrodoDataSource({ cookie: opts.cookie, cache, rateLimiter });
  }
  throw new Error(`Unknown DOUBAN_DATA_SOURCE=${kind}`);
}
