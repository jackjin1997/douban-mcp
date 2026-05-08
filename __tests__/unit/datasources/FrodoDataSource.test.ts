import axios from 'axios';
import { FrodoDataSource } from '../../../src/datasources/FrodoDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { AuthError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new FrodoDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 }),
  });
}

describe('FrodoDataSource.getCurrentUser', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns null without cookie', async () => {
    expect(await makeDS().getCurrentUser()).toBeNull();
  });
});

describe('FrodoDataSource invalid_request_997 (signature missing)', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('throws AuthError when frodo returns invalid_request_997', async () => {
    const { AuthError } = await import('../../../src/errors.js');
    mockedAxios.get.mockResolvedValue({
      status: 400,
      data: { request: 'GET /v2/movie/1', msg: 'invalid_request_997', code: 997, localized_message: '签名缺失' },
    });
    const ds = makeDS();
    await expect(ds.searchMovie('test', 5)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('FrodoDataSource.searchMovie', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('hits frodo /search/movie with apikey and parses subjects', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        subjects: [
          { id: '1', title: 'Movie 1', year: 2020, rating: { value: 8.5 }, url: 'https://movie.douban.com/subject/1/', pic: { normal: 'cover.jpg' } },
        ],
      },
    });
    const r = await makeDS().searchMovie('test', 5);
    expect(r[0].title).toBe('Movie 1');
    expect(r[0].rating).toBe(8.5);
    const callArgs = (mockedAxios.get as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toContain('/search/movie');
    expect(callArgs[1].params.apikey).toBeTruthy();
    expect(callArgs[1].params.q).toBe('test');
  });
});

describe('FrodoDataSource.getMovie', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns parsed MovieDetail', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        id: '3541415', title: '盗梦空间', year: 2010, original_title: 'Inception',
        rating: { value: 8.8, count: 1000 },
        directors: [{ id: 'd1', name: '诺兰', url: '' }],
        actors: [{ id: 'a1', name: 'A', url: '' }],
        genres: ['科幻'], countries: ['美国'],
        intro: '一个长得足够的简介'.repeat(3),
        pic: { normal: 'cover.jpg' },
      },
    });
    const m = await makeDS().getMovie('3541415');
    expect(m.id).toBe('3541415');
    expect(m.title).toContain('盗梦空间');
    expect(m.directors[0].name).toBe('诺兰');
  });
});

describe('FrodoDataSource.markSubject', () => {
  beforeEach(() => { mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); mockedAxios.delete.mockReset(); });

  it('throws AuthError without cookie', async () => {
    await expect(makeDS().markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('POSTs to /movie/<id>/interest with apikey + status', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
    const ds = makeDS('bid=x; dbcl2="42:y"; ck=CSRF');
    await ds.markSubject('movie', '999', 'collect', { rating: 5 });
    expect(mockedAxios.post).toHaveBeenCalled();
    const [path, body] = (mockedAxios.post as jest.Mock).mock.calls[0];
    expect(path).toContain('/movie/999/interest');
    const bodyStr = (body as URLSearchParams).toString();
    expect(bodyStr).toContain('apikey=');
    expect(bodyStr).toContain('status=done');  // collect → frodo "done"
    expect(bodyStr).toContain('rating=5');
  });
});

describe('FrodoDataSource.unmarkSubject', () => {
  beforeEach(() => mockedAxios.delete.mockReset());

  it('DELETEs /movie/<id>/interest', async () => {
    mockedAxios.delete.mockResolvedValue({ status: 200, data: {} });
    const ds = makeDS('bid=x; dbcl2="42:y"; ck=CSRF');
    await ds.unmarkSubject('movie', '999');
    const [path, cfg] = (mockedAxios.delete as jest.Mock).mock.calls[0];
    expect(path).toContain('/movie/999/interest');
    expect(cfg.params.apikey).toBeTruthy();
  });
});
