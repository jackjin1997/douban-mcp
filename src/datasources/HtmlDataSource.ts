import axios, { AxiosInstance } from 'axios';
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from './types.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import { CookieManager } from '../auth/CookieManager.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError, WriteDisabledError } from '../errors.js';
import { parseUserProfile } from './parsers/user.js';

export interface HtmlDataSourceOpts {
  cookie?: string;
  cache: MemoryCache;
  rateLimiter: DomainLimiter;
  userAgent?: string;
}

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 豆瓣 PoW 挑战页通常很短（< 5KB），含 captchaToken / challenge / verifyToken
function isPowChallenge(html: string, finalUrl: string): boolean {
  if (finalUrl.includes('/sec/captcha')) return true;
  if (typeof html === 'string' && html.length < 5000) {
    if (/captchaToken|verifyToken|window\.captcha/.test(html)) return true;
  }
  return false;
}

export class HtmlDataSource implements IDoubanDataSource {
  private http: AxiosInstance;
  private cookies: CookieManager;

  constructor(private opts: HtmlDataSourceOpts) {
    this.cookies = new CookieManager(opts.cookie);
    this.http = axios.create({
      headers: {
        'User-Agent': opts.userAgent ?? process.env.DOUBAN_USER_AGENT ?? DEFAULT_UA,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': this.cookies.toHeader(),
      },
      maxRedirects: 5,
      validateStatus: (s: number) => s < 500,
    });
  }

  // 测试用：暴露 httpGet 方便单测覆盖风控检测
  public async __probe(url: string): Promise<string> {
    return this.httpGet(url, { domain: new URL(url).host });
  }

  private async httpGet(url: string, opts: { domain: string; referer?: string } = { domain: 'movie.douban.com' }): Promise<string> {
    await this.opts.rateLimiter.acquireRead(opts.domain);
    let res;
    try {
      res = await this.http.get<string>(url, {
        headers: opts.referer ? { Referer: opts.referer } : {},
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    }
    if (res.status === 404) throw new NotFoundError(`404 at ${url}`);
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(opts.domain);
      throw new RateLimitError(`HTTP ${res.status} at ${url}`);
    }
    const finalUrl: string = (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url;
    const body = typeof res.data === 'string' ? res.data : '';
    if (isPowChallenge(body, finalUrl)) {
      this.opts.rateLimiter.markCooldown(opts.domain);
      throw new RateLimitError(
        `豆瓣 PoW 挑战触发于 ${finalUrl}。建议设置 DOUBAN_COOKIE 或切到 DOUBAN_DATA_SOURCE=frodo。`
      );
    }
    return res.data as string;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.cookies.hasLogin()) return null;
    return this.opts.cache.wrap('html:getCurrentUser', 300, async () => {
      const html = await this.httpGet('https://www.douban.com/mine/', { domain: 'www.douban.com' });
      try {
        return parseUserProfile(html);
      } catch {
        throw new AuthError('cookie present but profile fetch failed — cookie likely expired');
      }
    });
  }

  // 后续方法 NYI：M2.10/2.11/2.12 实现
  searchMovie(_q: string, _count: number): Promise<SubjectSummary[]> { return Promise.reject(new Error('NYI: M2.10')); }
  getMovie(_id: string): Promise<MovieDetail> { return Promise.reject(new Error('NYI: M2.10')); }
  getMovieReviews(_id: string, _count: number): Promise<Review[]> { return Promise.reject(new Error('NYI: M2.10')); }
  getMovieChart(_kind: MovieChartKind, _start: number, _count: number): Promise<SubjectSummary[]> { return Promise.reject(new Error('NYI: M2.10')); }
  searchBook(_q: string, _count: number): Promise<SubjectSummary[]> { return Promise.reject(new Error('NYI: M2.11')); }
  getBook(_id: string): Promise<BookDetail> { return Promise.reject(new Error('NYI: M2.11')); }
  getBookReviews(_id: string, _count: number): Promise<Review[]> { return Promise.reject(new Error('NYI: M2.11')); }
  getBookChart(_kind: BookChartKind, _count: number): Promise<SubjectSummary[]> { return Promise.reject(new Error('NYI: M2.11')); }
  getUserCollections(_uid: string | null, _category: 'movie' | 'book', _status: CollectionStatus, _start: number, _count: number): Promise<Collection[]> { return Promise.reject(new Error('NYI: M2.12')); }
  getUserDoulist(_uid: string | null): Promise<Doulist[]> { return Promise.reject(new Error('NYI: M2.12')); }
  getUserProfile(_uid: string | null): Promise<UserProfile> { return Promise.reject(new Error('NYI: M2.12')); }
  markSubject(_category: 'movie' | 'book', _id: string, _status: CollectionStatus, _options: MarkOptions): Promise<void> { return Promise.reject(new WriteDisabledError('write methods land in M4')); }
  unmarkSubject(_category: 'movie' | 'book', _id: string): Promise<void> { return Promise.reject(new WriteDisabledError('write methods land in M4')); }
}
