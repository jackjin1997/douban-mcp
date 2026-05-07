import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { AuthError, RateLimitError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 }),
  });
}

describe('HtmlDataSource.markSubject', () => {
  beforeEach(() => mockedAxios.post.mockReset());

  it('throws AuthError when no cookie', async () => {
    await expect(makeDS().markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('throws AuthError when cookie has no ck token', async () => {
    await expect(makeDS('bid=x; dbcl2="1:y"').markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('POSTs URL-encoded form with ck/interest/rating', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.markSubject('movie', '1234', 'collect', { rating: 5, comment: 'great', tags: ['ai'], shareToFeed: false });
    expect(mockedAxios.post).toHaveBeenCalled();
    const [url, body, cfg] = (mockedAxios.post as jest.Mock).mock.calls[0];
    expect(url).toContain('movie.douban.com/j/subject/1234/');
    const bodyStr = (body as URLSearchParams).toString();
    expect(bodyStr).toContain('ck=CSRF');
    expect(bodyStr).toContain('interest=collect');
    expect(bodyStr).toContain('rating=5');
    expect(bodyStr).toContain('comment=great');
    expect(bodyStr).toContain('tags=ai');
    expect(cfg.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
    expect(cfg.headers.Referer).toContain('movie.douban.com/subject/1234/');
  });

  it('uses book.douban.com domain for book category', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.markSubject('book', '999', 'wish', {});
    const [url] = (mockedAxios.post as jest.Mock).mock.calls[0];
    expect(url).toContain('book.douban.com/j/subject/999/');
  });

  it('invalidates own collection cache after success', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="42:y"; ck=CSRF');
    // populate cache
    await (ds as any).opts.cache.wrap('html:getUserCollections:42:movie:wish:0:15', 60, async () => 'cached');
    expect((ds as any).opts.cache.has('html:getUserCollections:42:movie:wish:0:15')).toBe(true);
    await ds.markSubject('movie', '1234', 'collect', {});
    expect((ds as any).opts.cache.has('html:getUserCollections:42:movie:wish:0:15')).toBe(false);
  });

  it('on 403 marks domain cooldown + locks write session', async () => {
    mockedAxios.post.mockResolvedValue({ status: 403, data: '' });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await expect(ds.markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
    // second call should be blocked by lockWriteForSession even with fresh cooldown
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
    await expect(ds.markSubject('movie', '2', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe('HtmlDataSource.unmarkSubject', () => {
  beforeEach(() => mockedAxios.post.mockReset());

  it('POSTs to /remove endpoint', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.unmarkSubject('movie', '1234');
    const [url, body] = (mockedAxios.post as jest.Mock).mock.calls.at(-1)!;
    expect(url).toContain('/1234/remove');
    expect((body as URLSearchParams).toString()).toContain('ck=CSRF');
  });
});
