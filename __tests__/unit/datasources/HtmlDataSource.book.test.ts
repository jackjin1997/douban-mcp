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

describe('HtmlDataSource.getBook', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed BookDetail from HTML', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('book/three-body.html'),
      request: { res: { responseUrl: 'https://book.douban.com/subject/2567698/' } },
    });
    const book = await makeDS().getBook('2567698');
    expect(book.title).toContain('三体');
    expect(book.authors.length).toBeGreaterThan(0);
  });
});

describe('HtmlDataSource.searchBook', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed search results', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('book/search-three-body.html'),
      request: { res: { responseUrl: 'https://search.douban.com/book/subject_search' } },
    });
    const items = await makeDS().searchBook('三体', 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^\d+$/);
  });
});
