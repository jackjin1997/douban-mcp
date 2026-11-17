import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { AuthError, RateLimitError, NotFoundError, ParseError, WriteRejectedError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const NO_PERMISSION_HTML =
  '<!DOCTYPE html><html><head><title>没有访问权限</title></head><body>你没有权限访问这个页面。请登录后重试。</body></html>';

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

  it.each(['wish', 'do', 'collect'] as const)(
    'POSTs status=%s to the fixed /interest endpoint (status goes in the form, not the path)',
    async (status) => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
      const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
      await ds.markSubject('movie', '38397487', status, {});
      const [url, body] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(url).toBe('https://movie.douban.com/j/subject/38397487/interest');
      expect((body as URLSearchParams).get('interest')).toBe(status);
    },
  );

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

    it('403 + {r:1, code:403} (anonymous / stale ck, observed live on /interest 2026-11-08) is AuthError without a write lock', async () => {
      mockedAxios.post.mockResolvedValue({ status: 403, data: { r: 1, code: 403 } });
      const ds = makeDS(ck);
      await expect(ds.markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
      // A refreshed cookie must be able to write again in the same session.
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
      await expect(ds.markSubject('movie', '2', 'collect', {})).resolves.toBeUndefined();
    });

    it('HTML 403 "没有访问权限" page (anonymous / stale ck) is AuthError without a write lock', async () => {
      mockedAxios.post.mockResolvedValue({ status: 403, data: NO_PERMISSION_HTML });
      const ds = makeDS(ck);
      await expect(ds.markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
      mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
      await expect(ds.markSubject('movie', '2', 'collect', {})).resolves.toBeUndefined();
    });

    it('404 + {r:1, code:404} (unknown subject or endpoint) is NotFoundError', async () => {
      mockedAxios.post.mockResolvedValue({ status: 404, data: { r: 1, code: 404 } });
      await expect(makeDS(ck).markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe('HtmlDataSource.unmarkSubject', () => {
  const ck = 'bid=x; dbcl2="1:y"; ck=CSRF';
  // GET /j/subject/<id>/interest after the removal: the state Douban actually kept.
  const readBack = (data: unknown, status = 200) => mockedAxios.get.mockResolvedValue({ status, data });
  const UNMARKED = { interest_status: '', html: '<form><input type="radio" name="interest" value="wish"><input type="radio" name="interest" value="collect"></form>' };

  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  it('POSTs to the page-level /subject/{id}/remove endpoint (no /j/ prefix)', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
    readBack(UNMARKED);
    await makeDS(ck).unmarkSubject('movie', '1234');
    const [url, body, cfg] = (mockedAxios.post as jest.Mock).mock.calls.at(-1)!;
    expect(url).toBe('https://movie.douban.com/subject/1234/remove');
    expect((body as URLSearchParams).toString()).toContain('ck=CSRF');
    expect(cfg.headers['Origin']).toBe('https://movie.douban.com');
  });

  it('uses book.douban.com for the book category, for both the removal and the read-back', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
    readBack(UNMARKED);
    await makeDS(ck).unmarkSubject('book', '999');
    expect((mockedAxios.post as jest.Mock).mock.calls.at(-1)![0]).toBe('https://book.douban.com/subject/999/remove');
    expect((mockedAxios.get as jest.Mock).mock.calls.at(-1)![0]).toBe('https://book.douban.com/j/subject/999/interest');
  });

  describe('success is decided by reading the state back, not by where the POST landed', () => {
    it('resolves when the read-back shows no interest status', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>subject page</html>',
        request: { res: { responseUrl: 'https://movie.douban.com/subject/1234/' } },
      });
      readBack(UNMARKED);
      await expect(makeDS(ck).unmarkSubject('movie', '1234')).resolves.toBeUndefined();
      expect((mockedAxios.get as jest.Mock).mock.calls.at(-1)![0]).toBe('https://movie.douban.com/j/subject/1234/interest');
    });

    it('rejects when the subject is still marked, even after a redirect back to the subject page', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>subject page</html>',
        request: { res: { responseUrl: 'https://movie.douban.com/subject/1234/' } },
      });
      readBack({ interest_status: 'collect' });
      await expect(makeDS(ck).unmarkSubject('movie', '1234'))
        .rejects.toMatchObject({ constructor: WriteRejectedError, message: expect.stringContaining('collect') });
    });

    it('rejects a 200 page that never left the POST URL when the subject is still marked', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>error</html>',
        request: { res: { responseUrl: 'https://movie.douban.com/subject/1234/remove' } },
      });
      readBack({ interest_status: 'wish' });
      await expect(makeDS(ck).unmarkSubject('movie', '1234')).rejects.toBeInstanceOf(WriteRejectedError);
    });

    it('rejects a landing on another subject (/subject/12345/) when the subject is still marked', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200, data: '<html>other subject</html>',
        request: { res: { responseUrl: 'https://movie.douban.com/subject/12345/' } },
      });
      readBack({ interest_status: 'do' });
      await expect(makeDS(ck).unmarkSubject('movie', '1234')).rejects.toBeInstanceOf(WriteRejectedError);
    });

    it('falls back to the checked radio in the dialog html when interest_status is absent', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
      readBack({ html: '<form><input type="radio" name="interest" value="wish" checked="checked"></form>' });
      await expect(makeDS(ck).unmarkSubject('movie', '1')).rejects.toBeInstanceOf(WriteRejectedError);
      readBack({ html: '<form><input type="radio" name="interest" value="wish"></form>' });
      await expect(makeDS(ck).unmarkSubject('movie', '1')).resolves.toBeUndefined();
    });

    it('a read-back without interest_status or html cannot confirm the removal: ParseError', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
      readBack({});
      await expect(makeDS(ck).unmarkSubject('movie', '1')).rejects.toBeInstanceOf(ParseError);
      readBack('<html>not json</html>');
      await expect(makeDS(ck).unmarkSubject('movie', '1')).rejects.toBeInstanceOf(ParseError);
    });

    it('invalidates the own collection cache only after a verified removal', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
      const ds = makeDS('bid=x; dbcl2="42:y"; ck=CSRF');
      const key = 'html:getUserCollections:42:movie:collect:0:15';
      await (ds as any).opts.cache.wrap(key, 60, async () => 'cached');
      readBack({ interest_status: 'collect' });
      await expect(ds.unmarkSubject('movie', '1')).rejects.toBeInstanceOf(WriteRejectedError);
      expect((ds as any).opts.cache.has(key)).toBe(true);
      readBack(UNMARKED);
      await ds.unmarkSubject('movie', '1');
      expect((ds as any).opts.cache.has(key)).toBe(false);
    });
  });

  it('HTML 403 "没有访问权限" page (anonymous / stale ck) is AuthError without a write lock', async () => {
    mockedAxios.post.mockResolvedValue({ status: 403, data: NO_PERMISSION_HTML });
    const ds = makeDS(ck);
    await expect(ds.unmarkSubject('book', '999')).rejects.toBeInstanceOf(AuthError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    mockedAxios.post.mockResolvedValue({ status: 200, data: '<html>subject page</html>' });
    readBack(UNMARKED);
    await expect(ds.unmarkSubject('book', '999')).resolves.toBeUndefined();
  });

  it('200 + risk-control HTML is RateLimitError, not success', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: '<html><script>var verifyToken="x"</script></html>' });
    await expect(makeDS(ck).unmarkSubject('movie', '1')).rejects.toBeInstanceOf(RateLimitError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('200 + {r:1} is WriteRejectedError', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 1, err: 'not marked' } });
    await expect(makeDS(ck).unmarkSubject('movie', '1')).rejects.toBeInstanceOf(WriteRejectedError);
  });
});
