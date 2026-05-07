import axios from 'axios';
import { HtmlDataSource } from '../../src/datasources/HtmlDataSource.js';
import { FrodoDataSource } from '../../src/datasources/FrodoDataSource.js';
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

function setupFrodo() {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: {
      id: '3541415',
      title: '盗梦空间',
      year: 2010,
      original_title: 'Inception',
      rating: { value: 8.8, count: 1000 },
      directors: [{ id: 'd1', name: '诺兰', url: '' }],
      actors: [{ id: 'a1', name: 'Leo', url: '' }],
      genres: ['科幻'],
      countries: ['美国'],
      intro: '盗梦小队进入梦境……',
      pic: { normal: 'cover.jpg' },
    },
  });
  return new FrodoDataSource({ cache: new MemoryCache(), rateLimiter: lim() });
}

describe('IDoubanDataSource contract — getMovie', () => {
  it('HtmlDataSource returns id and recognizable title', async () => {
    const m = await setupHtml().getMovie('3541415');
    expect(m.id).toBe('3541415');
    expect(m.title).toContain('盗梦空间');
    expect(m.url).toContain('movie.douban.com/subject/3541415');
  });

  it('FrodoDataSource returns id and recognizable title', async () => {
    const m = await setupFrodo().getMovie('3541415');
    expect(m.id).toBe('3541415');
    expect(m.title).toContain('盗梦空间');
    expect(m.url).toContain('movie.douban.com/subject/3541415');
  });

  it('both data sources expose the same MovieDetail field set', async () => {
    // Call Html first, then re-mock for Frodo
    const html = await setupHtml().getMovie('3541415');
    mockedAxios.get.mockReset();
    const frodo = await setupFrodo().getMovie('3541415');

    const requiredKeys = ['id', 'title', 'directors', 'casts', 'genres', 'countries', 'summary', 'url'] as const;
    for (const k of requiredKeys) {
      expect(html).toHaveProperty(k);
      expect(frodo).toHaveProperty(k);
    }
  });
});
