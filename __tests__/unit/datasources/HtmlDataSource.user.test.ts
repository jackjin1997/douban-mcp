import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { loadFixture } from '../../helpers/loadFixture.js';
import { AuthError } from '../../../src/errors.js';

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

describe('HtmlDataSource.getUserCollections', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('rejects with AuthError when uid=null and no cookie', async () => {
    await expect(makeDS().getUserCollections(null, 'movie', 'collect', 0, 20))
      .rejects.toBeInstanceOf(AuthError);
  });

  it('returns parsed collections when given uid', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('user/collections-watched.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/people/test/collect' } },
    });
    const list = await makeDS().getUserCollections('test', 'movie', 'collect', 0, 20);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].subject.id).toMatch(/^\d+$/);
  });
});

describe('HtmlDataSource.getUserProfile', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed profile for given uid', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('user/profile.html'),
      request: { res: { responseUrl: 'https://www.douban.com/people/test/' } },
    });
    const p = await makeDS().getUserProfile('test');
    expect(p.uid.length).toBeGreaterThan(0);
    expect(p.name.length).toBeGreaterThan(0);
  });
});

describe('HtmlDataSource.getUserDoulist (lenient)', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns array (possibly empty) without throwing', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('user/doulist.html'),
      request: { res: { responseUrl: 'https://www.douban.com/people/test/doulists/all' } },
    });
    const arr = await makeDS().getUserDoulist('test');
    expect(Array.isArray(arr)).toBe(true);
  });
});
