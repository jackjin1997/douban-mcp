import axios from 'axios';
import { HtmlDataSource } from '../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../src/ratelimit/Limiter.js';
import { loadFixture } from '../helpers/loadFixture.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const lim = () => new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 });

beforeEach(() => mockedAxios.get.mockReset());

function setupHtml() {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: loadFixture('movie/inception.html'),
    request: { res: { responseUrl: 'https://movie.douban.com/subject/3541415/' } },
  });
  return new HtmlDataSource({ cache: new MemoryCache(), rateLimiter: lim() });
}

describe('IDoubanDataSource contract — getMovie', () => {
  it('HtmlDataSource returns id and recognizable title', async () => {
    const m = await setupHtml().getMovie('3541415');
    expect(m.id).toBe('3541415');
    expect(m.title).toContain('盗梦空间');
    expect(m.url).toContain('movie.douban.com/subject/3541415');
  });

  it('HtmlDataSource exposes the full MovieDetail field set', async () => {
    const html = await setupHtml().getMovie('3541415');
    const requiredKeys = ['id', 'title', 'directors', 'casts', 'genres', 'countries', 'summary', 'url'] as const;
    for (const k of requiredKeys) expect(html).toHaveProperty(k);
  });
});
