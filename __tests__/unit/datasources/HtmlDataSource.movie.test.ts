import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { loadFixture } from '../../helpers/loadFixture.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS() {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

describe('HtmlDataSource.getMovie', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed MovieDetail from HTML', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/inception.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/subject/3541415/' } },
    });
    const ds = makeDS();
    const movie = await ds.getMovie('3541415');
    expect(movie.id).toBe('3541415');
    expect(movie.title).toContain('盗梦空间');
  });

  it('caches second call (axios called once)', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/inception.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/subject/3541415/' } },
    });
    const ds = makeDS();
    await ds.getMovie('3541415');
    await ds.getMovie('3541415');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('HtmlDataSource.searchMovie', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed search results', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/search-inception.html'),
      request: { res: { responseUrl: 'https://search.douban.com/movie/subject_search' } },
    });
    const ds = makeDS();
    const items = await ds.searchMovie('inception', 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^\d+$/);
  });
});

describe('HtmlDataSource.getMovieChart top250', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns 25 items for first page', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/top250.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/top250' } },
    });
    const ds = makeDS();
    const items = await ds.getMovieChart('top250', 0, 25);
    expect(items.length).toBe(25);
  });
});

describe('HtmlDataSource.getMovieChart weekly', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed weekly chart items', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/chart-weekly.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/chart' } },
    });
    const items = await makeDS().getMovieChart('weekly', 0, 10);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });
});

describe('HtmlDataSource.getMovieChart new (coming)', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed coming chart items', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/coming.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/coming' } },
    });
    const items = await makeDS().getMovieChart('new', 0, 10);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });
});
