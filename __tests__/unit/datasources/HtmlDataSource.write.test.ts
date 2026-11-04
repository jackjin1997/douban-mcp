import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { AuthError, RateLimitError, NotFoundError, ParseError, WriteRejectedError } from '../../../src/errors.js';

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
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    await expect(ds.markSubject('movie', '2', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
  });

  describe('response body validation', () => {
    const ck = 'bid=x; dbcl2="1:y"; ck=CSRF';
    const RISK_HTML = '<html><script>window.captcha = {}; var captchaToken = "x";</script></html>';

    it('200 + risk-control HTML is a failure: RateLimitError + session write lock', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: RISK_HTML });
      const ds = makeDS(ck);
      await expect(ds.markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
      mockedAxios.post.mockClear();
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
      await expect(ds.markSubject('movie', '2', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('200 redirected to sec.douban.com is risk control even with bland HTML', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>ok</html>',
        request: { res: { responseUrl: 'https://sec.douban.com/b?r=xxx' } },
      });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(RateLimitError);
    });

    it('200 redirected to the login page is AuthError', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>login</html>',
        request: { res: { responseUrl: 'https://accounts.douban.com/passport/login?redir=...' } },
      });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
    });

    it('200 + unrelated HTML is ParseError, not success', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: '<html><body>something else</body></html>' });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(ParseError);
    });

    it('200 + {r:1, err:"need_login"} is AuthError', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 1, err: 'need_login' } });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
    });

    it('200 + {r:1, err:"..."} is WriteRejectedError carrying the server message', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 1, err: 'rating out of range' } });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', { rating: 5 }))
        .rejects.toMatchObject({ constructor: WriteRejectedError, message: expect.stringContaining('rating out of range') });
    });

    it('200 + {} without r is not treated as success', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(WriteRejectedError);
    });

    it('404 + {r:1, code:404} (observed live 2026-11-04) is NotFoundError', async () => {
      mockedAxios.post.mockResolvedValue({ status: 404, data: { r: 1, code: 404 } });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe('HtmlDataSource.unmarkSubject', () => {
  beforeEach(() => mockedAxios.post.mockReset());

  it('POSTs to /remove endpoint', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.unmarkSubject('movie', '1234');
    const [url, body] = (mockedAxios.post as jest.Mock).mock.calls.at(-1)!;
    expect(url).toContain('/1234/remove');
    expect((body as URLSearchParams).toString()).toContain('ck=CSRF');
  });

  it('200 + risk-control HTML is RateLimitError, not success', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: '<html><script>var verifyToken="x"</script></html>' });
    await expect(makeDS('bid=x; dbcl2="1:y"; ck=CSRF').unmarkSubject('movie', '1')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('200 + {r:1} is WriteRejectedError', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 1, err: 'not marked' } });
    await expect(makeDS('bid=x; dbcl2="1:y"; ck=CSRF').unmarkSubject('movie', '1')).rejects.toBeInstanceOf(WriteRejectedError);
  });
});
