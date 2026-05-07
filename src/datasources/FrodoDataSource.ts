import axios, { AxiosInstance } from 'axios';
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from './types.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import { CookieManager } from '../auth/CookieManager.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError } from '../errors.js';

export interface FrodoOpts {
  cookie?: string;
  cache: MemoryCache;
  rateLimiter: DomainLimiter;
  apikey?: string;
}

const DEFAULT_APIKEY = '0dad551ec0f84ed02907ff5c42e8ec70';
const DEFAULT_UA = 'api-client/1 com.douban.frodo/7.32.0(231) Android/30 product/redfin vendor/google model/Pixel  rom/google network/wifi  platform/mobile com.douban.frodo/0';

function statusToFrodo(s: CollectionStatus): string {
  return s === 'wish' ? 'mark' : s === 'do' ? 'doing' : 'done';
}

function mapSubject(s: Record<string, unknown>): SubjectSummary {
  const rating = s.rating;
  let ratingValue: number | undefined;
  if (typeof rating === 'number') {
    ratingValue = rating;
  } else if (rating && typeof rating === 'object' && 'value' in rating) {
    ratingValue = (rating as { value: number }).value;
  }
  const pic = s.pic as { normal?: string } | undefined;
  return {
    id: String(s.id ?? ''),
    title: (s.title as string) ?? '',
    year: s.year ? String(s.year) : undefined,
    rating: ratingValue,
    url: (s.url as string) ?? `https://${s.type === 'book' ? 'book' : 'movie'}.douban.com/subject/${s.id}/`,
    cover: pic?.normal ?? (s.cover_url as string | undefined),
  };
}

function personFromObj(p: Record<string, unknown>) {
  return { id: String(p.id ?? ''), name: (p.name as string) ?? '', url: (p.url as string) ?? '' };
}

export class FrodoDataSource implements IDoubanDataSource {
  private http: AxiosInstance;
  private cookies: CookieManager;
  private apikey: string;

  constructor(private opts: FrodoOpts) {
    this.cookies = new CookieManager(opts.cookie);
    this.apikey = opts.apikey ?? process.env.DOUBAN_FRODO_APIKEY ?? DEFAULT_APIKEY;
    this.http = axios.create({
      baseURL: 'https://frodo.douban.com/api/v2',
      headers: {
        'User-Agent': DEFAULT_UA,
        'Cookie': this.cookies.toHeader(),
      },
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const domain = 'frodo.douban.com';
    await this.opts.rateLimiter.acquireRead(domain);
    const res = await this.http.get<T>(path, {
      params: { apikey: this.apikey, ...params },
      validateStatus: s => s < 500,
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });
    if (res.status === 404) throw new NotFoundError(`frodo 404 ${path}`);
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      throw new RateLimitError(`frodo ${res.status} ${path}`);
    }
    return res.data;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.cookies.hasLogin()) return null;
    return this.opts.cache.wrap('frodo:getCurrentUser', 300, async () => {
      const data = await this.get<Record<string, unknown>>('/user/~me');
      return { uid: String(data.id ?? data.uid ?? ''), name: (data.name as string) ?? '', avatar: (data.avatar as string) ?? '' };
    });
  }

  async searchMovie(q: string, count: number): Promise<SubjectSummary[]> {
    return this.opts.cache.wrap(`frodo:searchMovie:${q}:${count}`, 1800, async () => {
      const data = await this.get<Record<string, unknown>>('/search/movie', { q, count });
      return ((data.subjects ?? data.items ?? []) as Record<string, unknown>[]).slice(0, count).map(mapSubject);
    });
  }

  async getMovie(id: string): Promise<MovieDetail> {
    return this.opts.cache.wrap(`frodo:getMovie:${id}`, 21600, async () => {
      const d = await this.get<Record<string, unknown>>(`/movie/${id}`);
      const rating = d.rating as { value?: number; count?: number } | undefined;
      const pic = d.pic as { normal?: string } | undefined;
      const pubdate = d.pubdate as string[] | undefined;
      const durations = d.durations as string[] | undefined;
      return {
        id,
        title: (d.title as string) ?? '',
        originalTitle: d.original_title as string | undefined,
        year: d.year ? String(d.year) : undefined,
        rating: rating?.value,
        ratingCount: rating?.count ?? 0,
        url: (d.url as string) ?? `https://movie.douban.com/subject/${id}/`,
        cover: pic?.normal,
        directors: ((d.directors ?? []) as Record<string, unknown>[]).map(personFromObj),
        casts: ((d.actors ?? []) as Record<string, unknown>[]).map(personFromObj),
        genres: (d.genres as string[]) ?? [],
        countries: (d.countries as string[]) ?? [],
        releaseDate: pubdate?.[0],
        duration: durations?.[0],
        imdbId: d.imdb as string | undefined,
        summary: (d.intro as string) ?? '',
      };
    });
  }

  async getMovieReviews(id: string, count: number): Promise<Review[]> {
    return this.opts.cache.wrap(`frodo:getMovieReviews:${id}:${count}`, 1800, async () => {
      const d = await this.get<Record<string, unknown>>(`/movie/${id}/interests`, { count, status: 'done' });
      return ((d.interests ?? []) as Record<string, unknown>[]).map((i) => {
        const user = i.user as Record<string, unknown> | undefined;
        const iRating = i.rating as { value?: number } | undefined;
        return {
          author: (user?.name as string) ?? '',
          authorUid: String(user?.id ?? ''),
          rating: iRating?.value,
          content: (i.comment as string) ?? '',
          publishedAt: (i.create_time as string) ?? '',
          usefulCount: (i.vote_count as number) ?? 0,
        };
      });
    });
  }

  async getMovieChart(kind: MovieChartKind, _start: number, count: number): Promise<SubjectSummary[]> {
    const path = kind === 'top250' ? '/movie/top250' : kind === 'weekly' ? '/movie/weekly' : '/movie/coming_soon';
    return this.opts.cache.wrap(`frodo:getMovieChart:${kind}:${count}`, 3600, async () => {
      const d = await this.get<Record<string, unknown>>(path, { count });
      return ((d.subjects ?? d.items ?? []) as Record<string, unknown>[]).slice(0, count).map(mapSubject);
    });
  }

  async searchBook(q: string, count: number): Promise<SubjectSummary[]> {
    return this.opts.cache.wrap(`frodo:searchBook:${q}:${count}`, 1800, async () => {
      const data = await this.get<Record<string, unknown>>('/search/book', { q, count });
      return ((data.subjects ?? data.items ?? []) as Record<string, unknown>[]).slice(0, count).map(mapSubject);
    });
  }

  async getBook(id: string): Promise<BookDetail> {
    return this.opts.cache.wrap(`frodo:getBook:${id}`, 21600, async () => {
      const d = await this.get<Record<string, unknown>>(`/book/${id}`);
      const rating = d.rating as { value?: number; count?: number } | undefined;
      const pic = d.pic as { normal?: string } | undefined;
      const press = d.press as string[] | undefined;
      const pubdate = (d.pubdate as string) ?? '';
      const yearMatch = pubdate.match(/\d{4}/);
      return {
        id,
        title: (d.title as string) ?? '',
        year: yearMatch?.[0],
        rating: rating?.value,
        ratingCount: rating?.count ?? 0,
        url: (d.url as string) ?? `https://book.douban.com/subject/${id}/`,
        cover: pic?.normal,
        authors: (d.author as string[]) ?? [],
        translators: (d.translator as string[]) ?? [],
        publisher: press?.[0],
        publishDate: pubdate || undefined,
        pages: parseInt(d.pages as string, 10) || undefined,
        price: d.price as string | undefined,
        isbn: (d.isbn13 ?? d.isbn10) as string | undefined,
        summary: (d.intro as string) ?? '',
      };
    });
  }

  async getBookReviews(id: string, count: number): Promise<Review[]> {
    return this.opts.cache.wrap(`frodo:getBookReviews:${id}:${count}`, 1800, async () => {
      const d = await this.get<Record<string, unknown>>(`/book/${id}/interests`, { count, status: 'done' });
      return ((d.interests ?? []) as Record<string, unknown>[]).map((i) => {
        const user = i.user as Record<string, unknown> | undefined;
        const iRating = i.rating as { value?: number } | undefined;
        return {
          author: (user?.name as string) ?? '',
          authorUid: String(user?.id ?? ''),
          rating: iRating?.value,
          content: (i.comment as string) ?? '',
          publishedAt: (i.create_time as string) ?? '',
          usefulCount: (i.vote_count as number) ?? 0,
        };
      });
    });
  }

  async getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]> {
    const tag = kind === 'fiction' ? '小说' : kind === 'non_fiction' ? '随笔' : '新书';
    return this.opts.cache.wrap(`frodo:getBookChart:${kind}:${count}`, 3600, async () => {
      const d = await this.get<Record<string, unknown>>('/book/recommend', { tag, count });
      return ((d.subjects ?? d.items ?? []) as Record<string, unknown>[]).slice(0, count).map(mapSubject);
    });
  }

  private resolveUid(uid: string | null): string {
    if (uid) return uid;
    const own = this.cookies.getOwnUid();
    if (!own) throw new AuthError('uid is null and no DOUBAN_COOKIE');
    return own;
  }

  async getUserCollections(uid: string | null, category: 'movie' | 'book', status: CollectionStatus, start: number, count: number): Promise<Collection[]> {
    const realUid = this.resolveUid(uid);
    const ttl = uid === null ? 300 : 1800;
    return this.opts.cache.wrap(`frodo:getUserCollections:${realUid}:${category}:${status}:${start}:${count}`, ttl, async () => {
      const path = category === 'movie' ? `/user/${realUid}/interests` : `/user/${realUid}/book_interests`;
      const fr = statusToFrodo(status);
      const d = await this.get<Record<string, unknown>>(path, { status: fr, start, count });
      return ((d.interests ?? []) as Record<string, unknown>[]).map((i) => {
        const subject = i.subject as Record<string, unknown> | undefined;
        const iRating = i.rating as { value?: number } | undefined;
        return {
          subject: mapSubject(subject ?? {}),
          status,
          rating: iRating?.value,
          comment: (i.comment as string) || undefined,
          tags: (i.tags as string[]) ?? [],
          markedAt: (i.create_time as string) ?? '',
        };
      });
    });
  }

  async getUserDoulist(uid: string | null): Promise<Doulist[]> {
    const realUid = this.resolveUid(uid);
    return this.opts.cache.wrap(`frodo:getUserDoulist:${realUid}`, 3600, async () => {
      const d = await this.get<Record<string, unknown>>(`/user/${realUid}/owned_doulists`);
      return ((d.doulists ?? []) as Record<string, unknown>[]).map((x) => ({
        id: String(x.id),
        title: (x.title as string) ?? '',
        description: (x.desc as string) ?? '',
        itemCount: (x.items_count as number) ?? 0,
        url: (x.uri as string) ?? '',
      }));
    });
  }

  async getUserProfile(uid: string | null): Promise<UserProfile> {
    const realUid = this.resolveUid(uid);
    return this.opts.cache.wrap(`frodo:getUserProfile:${realUid}`, 3600, async () => {
      const d = await this.get<Record<string, unknown>>(`/user/${realUid}`);
      return { uid: String(d.id ?? realUid), name: (d.name as string) ?? '', avatar: (d.avatar as string) ?? '', signature: d.intro as string | undefined };
    });
  }

  async markSubject(category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('mark requires DOUBAN_COOKIE');
    const domain = 'frodo.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);
    const path = `/${category}/${id}/interest`;
    const params = new URLSearchParams();
    params.set('apikey', this.apikey);
    params.set('status', statusToFrodo(status));
    if (options.rating != null) params.set('rating', String(options.rating));
    if (options.comment) params.set('comment', options.comment);
    if (options.tags?.length) params.set('tags', options.tags.join(' '));
    params.set('share', options.shareToFeed ? 'true' : 'false');
    const res = await this.http.post(path, params, { validateStatus: s => s < 500 }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      this.opts.rateLimiter.lockWriteForSession(domain);
      throw new RateLimitError('frodo write blocked');
    }
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);
    const own = this.cookies.getOwnUid();
    if (own) this.opts.cache.invalidate(`frodo:getUserCollections:${own}:${category}`);
  }

  async unmarkSubject(category: 'movie' | 'book', id: string): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('unmark requires DOUBAN_COOKIE');
    const domain = 'frodo.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);
    const res = await this.http.delete(`/${category}/${id}/interest`, {
      params: { apikey: this.apikey },
      validateStatus: s => s < 500,
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'network error';
      throw new NetworkError(msg);
    });
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      this.opts.rateLimiter.lockWriteForSession(domain);
      throw new RateLimitError('frodo unmark blocked');
    }
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);
    const own = this.cookies.getOwnUid();
    if (own) this.opts.cache.invalidate(`frodo:getUserCollections:${own}:${category}`);
  }
}
