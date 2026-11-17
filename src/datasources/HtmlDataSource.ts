import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from './types.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import { CookieManager } from '../auth/CookieManager.js';
import { AuthError, NetworkError, NotFoundError, ParseError, RateLimitError, WriteRejectedError } from '../errors.js';
import { parseUserProfile, parseUserCollections, parseUserDoulist } from './parsers/user.js';
import {
  parseMovieDetail, parseMovieSearch, parseTop250, parseMovieReviewsFromHtml,
  parseMovieWeeklyChart, parseMovieComingChart,
} from './parsers/movie.js';
import {
  parseBookDetail, parseBookSearch, parseBookReviewsFromHtml, parseBookTagList, parseBookLatest,
} from './parsers/book.js';

export interface HtmlDataSourceOpts {
  cookie?: string;
  cache: MemoryCache;
  rateLimiter: DomainLimiter;
  userAgent?: string;
}

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 豆瓣风控页面识别：
// - 重定向到 sec.douban.com 域（短简单 HTML，无明显 token）
// - URL 含 /sec/captcha
// - 短页面（<5KB）含 captchaToken/verifyToken/window.captcha
function isPowChallenge(html: string, finalUrl: string): boolean {
  if (finalUrl.includes('sec.douban.com')) return true;
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
    const res = await this.http.get<string>(url, {
      headers: opts.referer ? { Referer: opts.referer } : {},
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });
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
        `豆瓣 PoW 挑战触发于 ${finalUrl}。建议设置 DOUBAN_COOKIE 后重试。`
      );
    }
    return res.data as string;
  }

  private resolveUid(uid: string | null): string {
    if (uid) return uid;
    const own = this.cookies.getOwnUid();
    if (!own) throw new AuthError('uid is null and no DOUBAN_COOKIE configured');
    return own;
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

  async searchMovie(q: string, count: number): Promise<SubjectSummary[]> {
    const key = `html:searchMovie:${q}:${count}`;
    return this.opts.cache.wrap(key, 1800, async () => {
      const url = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(q)}&cat=1002`;
      const html = await this.httpGet(url, { domain: 'search.douban.com' });
      return parseMovieSearch(html).slice(0, count);
    });
  }

  async getMovie(id: string): Promise<MovieDetail> {
    const key = `html:getMovie:${id}`;
    return this.opts.cache.wrap(key, 21600, async () => {
      const html = await this.httpGet(`https://movie.douban.com/subject/${id}/`, { domain: 'movie.douban.com' });
      return parseMovieDetail(html, id);
    });
  }

  async getMovieReviews(id: string, count: number): Promise<Review[]> {
    const key = `html:getMovieReviews:${id}:${count}`;
    return this.opts.cache.wrap(key, 1800, async () => {
      const html = await this.httpGet(`https://movie.douban.com/subject/${id}/comments?status=P`, { domain: 'movie.douban.com' });
      return parseMovieReviewsFromHtml(html).slice(0, count);
    });
  }

  async getMovieChart(kind: MovieChartKind, start: number, count: number): Promise<SubjectSummary[]> {
    const key = `html:getMovieChart:${kind}:${start}:${count}`;
    return this.opts.cache.wrap(key, 3600, async () => {
      if (kind === 'top250') {
        const html = await this.httpGet(`https://movie.douban.com/top250?start=${start}`, { domain: 'movie.douban.com' });
        return parseTop250(html).slice(0, count);
      }
      if (kind === 'weekly') {
        const html = await this.httpGet('https://movie.douban.com/chart', { domain: 'movie.douban.com' });
        return parseMovieWeeklyChart(html).slice(0, count);
      }
      const html = await this.httpGet('https://movie.douban.com/coming', { domain: 'movie.douban.com' });
      return parseMovieComingChart(html).slice(0, count);
    });
  }
  async searchBook(q: string, count: number): Promise<SubjectSummary[]> {
    const key = `html:searchBook:${q}:${count}`;
    return this.opts.cache.wrap(key, 1800, async () => {
      const url = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(q)}`;
      const html = await this.httpGet(url, { domain: 'search.douban.com' });
      return parseBookSearch(html).slice(0, count);
    });
  }

  async getBook(id: string): Promise<BookDetail> {
    const key = `html:getBook:${id}`;
    return this.opts.cache.wrap(key, 21600, async () => {
      const html = await this.httpGet(`https://book.douban.com/subject/${id}/`, { domain: 'book.douban.com' });
      return parseBookDetail(html, id);
    });
  }

  async getBookReviews(id: string, count: number): Promise<Review[]> {
    const key = `html:getBookReviews:${id}:${count}`;
    return this.opts.cache.wrap(key, 1800, async () => {
      const html = await this.httpGet(`https://book.douban.com/subject/${id}/comments/`, { domain: 'book.douban.com' });
      return parseBookReviewsFromHtml(html).slice(0, count);
    });
  }

  async getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]> {
    const key = `html:getBookChart:${kind}:${count}`;
    return this.opts.cache.wrap(key, 3600, async () => {
      if (kind === 'new') {
        const html = await this.httpGet('https://book.douban.com/latest', { domain: 'book.douban.com' });
        return parseBookLatest(html).slice(0, count);
      }
      const tag = kind === 'fiction' ? '小说' : '随笔';
      const url = `https://book.douban.com/tag/${encodeURIComponent(tag)}`;
      const html = await this.httpGet(url, { domain: 'book.douban.com' });
      return parseBookTagList(html).slice(0, count);
    });
  }
  async getUserCollections(
    uid: string | null, category: 'movie' | 'book', status: CollectionStatus, start: number, count: number
  ): Promise<Collection[]> {
    const realUid = this.resolveUid(uid);
    const ttl = uid === null ? 300 : 1800;
    const key = `html:getUserCollections:${realUid}:${category}:${status}:${start}:${count}`;
    return this.opts.cache.wrap(key, ttl, async () => {
      const base = category === 'movie' ? 'https://movie.douban.com' : 'https://book.douban.com';
      const path = status === 'wish' ? 'wish' : status === 'do' ? 'do' : 'collect';
      const url = `${base}/people/${realUid}/${path}?start=${start}`;
      const html = await this.httpGet(url, { domain: new URL(base).host });
      return parseUserCollections(html, category, status).slice(0, count);
    });
  }

  async getUserDoulist(uid: string | null): Promise<Doulist[]> {
    const realUid = this.resolveUid(uid);
    const key = `html:getUserDoulist:${realUid}`;
    return this.opts.cache.wrap(key, 3600, async () => {
      const html = await this.httpGet(`https://www.douban.com/people/${realUid}/doulists/all`, { domain: 'www.douban.com' });
      return parseUserDoulist(html);
    });
  }

  async getUserProfile(uid: string | null): Promise<UserProfile> {
    const realUid = this.resolveUid(uid);
    const key = `html:getUserProfile:${realUid}`;
    return this.opts.cache.wrap(key, 3600, async () => {
      const html = await this.httpGet(`https://www.douban.com/people/${realUid}/`, { domain: 'www.douban.com' });
      return parseUserProfile(html);
    });
  }
  /**
   * Turn the responses Douban uses to *block* a write into typed errors, and
   * return the final URL. Shared by the JSON endpoints (mark) and the
   * page-level form endpoint (unmark).
   *
   * Observed live with anonymous requests: `/j/subject/<id>/interest` → 403
   * `{"r":1,"code":403}` (2026-11-08); `book.douban.com/subject/<id>/remove`
   * → 403 HTML titled 没有访问权限 (2026-11-17). Both mean "not logged in or
   * stale ck", a cookie problem the user fixes by refreshing DOUBAN_COOKIE,
   * so neither may engage the session write lock that real risk control
   * (challenge page, sec.douban.com redirect, bare 401/403) does.
   */
  private rejectBlockedResponse(res: AxiosResponse, domain: string, url: string): string {
    const finalUrl: string = (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url;
    const blockedByRiskControl = (why: string): never => {
      this.opts.rateLimiter.markCooldown(domain);
      this.opts.rateLimiter.lockWriteForSession(domain);
      throw new RateLimitError(`write blocked by risk control (${why}); session write lock engaged`);
    };

    const body: unknown = res.data;
    if (res.status === 401 || res.status === 403) {
      const isJsonRefusal = !!body && typeof body === 'object' && 'r' in body;
      const isNoPermissionPage = typeof body === 'string' && body.includes('没有访问权限');
      if (isJsonRefusal || isNoPermissionPage) {
        throw new AuthError(`douban refused write with HTTP ${res.status}; cookie or ck token likely expired`);
      }
      blockedByRiskControl(`HTTP ${res.status}`);
    }
    if (typeof body === 'string') {
      if (isPowChallenge(body, finalUrl)) blockedByRiskControl(`challenge page at ${finalUrl}`);
      if (/accounts\.douban\.com|\/accounts\/login/.test(finalUrl)) {
        throw new AuthError(`write redirected to login page (${finalUrl}); cookie likely expired`);
      }
    }
    return finalUrl;
  }

  /**
   * The /j/ JSON endpoints answer `{r: 0}` on success and `{r: 1, err|code}`
   * on refusal; an unknown path such as `/collect` → 404 `{"r":1,"code":404}`.
   */
  private assertJsonAck(res: AxiosResponse, url: string): void {
    const j = (res.data && typeof res.data === 'object' ? res.data : {}) as { r?: unknown; err?: unknown; msg?: unknown; code?: unknown };
    if (j.r === 0) return;

    const detail = j.err != null ? String(j.err)
      : j.msg != null ? String(j.msg)
      : j.code != null ? `code ${String(j.code)}`
      : j.r === undefined ? 'response has no "r" field' : `r=${String(j.r)}`;
    if (/login|登录/i.test(detail)) throw new AuthError(`douban rejected write: ${detail}`);
    if (res.status === 404) throw new NotFoundError(`write endpoint 404 at ${url} (${detail})`);
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status} at ${url} (${detail})`);
    throw new WriteRejectedError(detail);
  }

  /**
   * A write only counts as done when Douban says so: the old `status < 400`
   * check reported risk-control pages and expired cookies as success.
   */
  private assertWriteAccepted(res: AxiosResponse, domain: string, url: string): void {
    const finalUrl = this.rejectBlockedResponse(res, domain, url);
    if (typeof res.data === 'string') {
      throw new ParseError(`write endpoint returned non-JSON body (HTTP ${res.status}) at ${finalUrl}`);
    }
    this.assertJsonAck(res, url);
  }

  /**
   * Read back the interest state Douban actually kept for a subject: the same
   * GET the collect dialog makes. Returns `wish` / `do` / `collect`, or null
   * when the subject is not marked. The JSON carries `interest_status`, or for
   * older responses only the dialog `html`, whose checked radio is the state
   * (the shape wastedwood/DouBanSync relies on).
   */
  private async readInterestStatus(domain: string, id: string): Promise<string | null> {
    await this.opts.rateLimiter.acquireRead(domain);
    const url = `https://${domain}/j/subject/${id}/interest`;
    const res = await this.http.get(url, {
      headers: {
        'Referer': `https://${domain}/subject/${id}/`,
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': this.cookies.toHeader(),
      },
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });

    const finalUrl = this.rejectBlockedResponse(res, domain, url);
    if (res.status === 404) throw new NotFoundError(`subject ${id} not found at ${url}`);
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status} at ${url}`);

    const body: unknown = res.data;
    if (!body || typeof body !== 'object') {
      throw new ParseError(`could not verify the interest state: non-JSON answer (HTTP ${res.status}) at ${finalUrl}`);
    }
    const j = body as { interest_status?: unknown; html?: unknown };
    if (typeof j.interest_status === 'string' && j.interest_status) return j.interest_status;
    if (typeof j.html === 'string') {
      return cheerio.load(j.html)('input[name="interest"][checked]').attr('value') || null;
    }
    if ('interest_status' in j) return null;
    throw new ParseError(`could not verify the interest state: answer has neither interest_status nor html at ${url}`);
  }

  async markSubject(
    category: 'movie' | 'book',
    id: string,
    status: CollectionStatus,
    options: MarkOptions,
  ): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('mark requires DOUBAN_COOKIE');
    const ck = this.cookies.getCkToken();
    if (!ck) throw new AuthError('cookie missing ck token (CSRF)');

    const domain = category === 'movie' ? 'movie.douban.com' : 'book.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);

    const params = new URLSearchParams();
    params.set('ck', ck);
    params.set('interest', status);
    if (options.rating != null) params.set('rating', String(options.rating));
    if (options.comment) params.set('comment', options.comment);
    if (options.tags?.length) params.set('tags', options.tags.join(' '));
    params.set('share-shuo', options.shareToFeed ? 'douban' : '');

    // Douban's mark endpoint is fixed; the status travels in the `interest` form field.
    const url = `https://${domain}/j/subject/${id}/interest`;
    const res = await this.http.post(url, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `https://${domain}/subject/${id}/`,
        'Cookie': this.cookies.toHeader(),
      },
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });

    this.assertWriteAccepted(res, domain, url);

    const ownUid = this.cookies.getOwnUid();
    if (ownUid) this.opts.cache.invalidate(`html:getUserCollections:${ownUid}:${category}`);
  }

  async unmarkSubject(category: 'movie' | 'book', id: string): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('unmark requires DOUBAN_COOKIE');
    const ck = this.cookies.getCkToken();
    if (!ck) throw new AuthError('cookie missing ck token');

    const domain = category === 'movie' ? 'movie.douban.com' : 'book.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);

    const params = new URLSearchParams();
    params.set('ck', ck);

    // Douban has no /j/ JSON remove endpoint — /j/subject/{id}/remove answers
    // 404 {"r":1,"code":404} for every subject (verified live 2026-11-17).
    // The working endpoint is the page-level form POST /subject/{id}/remove,
    // same as DouBanSync and MoviePilot's douban plugin use.
    const url = `https://${domain}/subject/${id}/remove`;
    const res = await this.http.post(url, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `https://${domain}/subject/${id}/`,
        'Origin': `https://${domain}`,
        'Cookie': this.cookies.toHeader(),
      },
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });

    // The form endpoint answers HTML (a 302 back to the subject page when it
    // works), so where the POST lands proves nothing: an error page, or a
    // redirect that removed nothing, looks the same. Only reject what clearly
    // blocked the request here, then decide by the state Douban actually kept.
    this.rejectBlockedResponse(res, domain, url);
    if (res.data && typeof res.data === 'object' && 'r' in res.data) this.assertJsonAck(res, url);
    else if (res.status === 404) throw new NotFoundError(`subject ${id} not found at ${url}`);
    else if (res.status >= 400) throw new NetworkError(`HTTP ${res.status} at ${url}`);

    const still = await this.readInterestStatus(domain, id);
    if (still) throw new WriteRejectedError(`unmark did not take effect: subject ${id} is still marked "${still}"`);

    const ownUid = this.cookies.getOwnUid();
    if (ownUid) this.opts.cache.invalidate(`html:getUserCollections:${ownUid}:${category}`);
  }
}
