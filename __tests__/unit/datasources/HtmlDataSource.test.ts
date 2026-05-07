import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { RateLimitError, NotFoundError, AuthError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

describe('HtmlDataSource.httpGet (via __probe)', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('throws RateLimitError when response URL contains /sec/captcha', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: '<html><a href="/sec/captcha">verify</a></html>',
      request: { res: { responseUrl: 'https://movie.douban.com/sec/captcha' } },
    });
    const ds = makeDS();
    await expect((ds as any).__probe('https://movie.douban.com/x'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws RateLimitError on PoW challenge HTML signature', async () => {
    // 豆瓣 PoW 挑战页通常是约 3KB 包含 challenge / verifyToken / window.captchaToken 的 JS
    const challengeHtml = '<html><script>window.captchaToken="x"; var challenge="...";</script></html>';
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: challengeHtml,
      request: { res: { responseUrl: 'https://movie.douban.com/subject/1/' } },
    });
    const ds = makeDS();
    await expect((ds as any).__probe('https://movie.douban.com/subject/1/'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws NotFoundError on 404', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 404, data: '', request: { res: { responseUrl: 'x' } },
    });
    await expect((makeDS() as any).__probe('https://movie.douban.com/x'))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns body on 200 with normal HTML', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200, data: '<html><body>real content here that is long enough</body></html>',
      request: { res: { responseUrl: 'https://movie.douban.com/' } },
    });
    const html = await (makeDS() as any).__probe('https://movie.douban.com/');
    expect(html).toContain('real content');
  });
});

describe('HtmlDataSource.getCurrentUser', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns null without cookie', async () => {
    expect(await makeDS().getCurrentUser()).toBeNull();
  });

  it('throws AuthError when cookie present but profile fetch parses empty', async () => {
    // /mine/ redirects to login when cookie expired — body has no profile content
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: '<html><body><div>登录</div></body></html>',
      request: { res: { responseUrl: 'https://www.douban.com/accounts/login' } },
    });
    const ds = makeDS('bid=x; dbcl2="123:abc"');
    await expect(ds.getCurrentUser()).rejects.toBeInstanceOf(AuthError);
  });
});
