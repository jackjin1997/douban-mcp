import { parseMovieDetail, parseMovieSearch, parseTop250, parseMovieWeeklyChart, parseMovieComingChart } from '../../../src/datasources/parsers/movie.js';
import { ParseError } from '../../../src/errors.js';
import { loadFixture } from '../../helpers/loadFixture.js';

describe('parseMovieDetail (Inception)', () => {
  const movie = parseMovieDetail(loadFixture('movie/inception.html'), '3541415');
  it('extracts title and id', () => {
    expect(movie.id).toBe('3541415');
    expect(movie.title).toContain('盗梦空间');
  });
  it('extracts directors and casts', () => {
    expect(movie.directors.length).toBeGreaterThan(0);
    expect(movie.directors[0].name).toContain('诺兰');
    expect(movie.casts.length).toBeGreaterThan(0);
  });
  it('extracts numeric rating between 0 and 10', () => {
    expect(movie.rating).toBeGreaterThan(0);
    expect(movie.rating).toBeLessThanOrEqual(10);
  });
  it('extracts ratingCount as positive integer', () => {
    expect(movie.ratingCount).toBeGreaterThan(0);
  });
  it('extracts genres array', () => {
    expect(movie.genres.length).toBeGreaterThan(0);
  });
  it('extracts non-empty summary', () => {
    expect(movie.summary.length).toBeGreaterThan(20);
  });
});

describe('parseMovieSearch (inception)', () => {
  const items = parseMovieSearch(loadFixture('movie/search-inception.html'));
  it('returns at least one result', () => { expect(items.length).toBeGreaterThan(0); });
  it('each item has id, title, url', () => {
    for (const item of items.slice(0, 3)) {
      expect(item.id).toMatch(/^\d+$/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.url).toContain('movie.douban.com/subject/');
    }
  });
});

describe('parseTop250', () => {
  const items = parseTop250(loadFixture('movie/top250.html'));
  it('returns 25 items per page', () => { expect(items.length).toBe(25); });
  it('throws ParseError when the grid container is missing (structure drift)', () => {
    expect(() => parseTop250('<html><body><div id="content">nothing</div></body></html>')).toThrow(ParseError);
  });
  it('returns [] for an empty grid (page past the end of the list)', () => {
    expect(parseTop250('<html><body><ol class="grid_view"></ol></body></html>')).toEqual([]);
  });
});

describe('parseMovieWeeklyChart', () => {
  const items = parseMovieWeeklyChart(loadFixture('movie/chart-weekly.html'));
  it('returns at least 5 items with subject id and title', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0].id).toMatch(/^\d+$/);
    expect(items[0].title.length).toBeGreaterThan(0);
  });
  it('throws ParseError instead of returning [] when no rows match', () => {
    expect(() => parseMovieWeeklyChart('<html><body><table><tr><td>x</td></tr></table></body></html>')).toThrow(ParseError);
  });
});

describe('parseMovieComingChart', () => {
  const items = parseMovieComingChart(loadFixture('movie/coming.html'));
  it('returns at least 5 items with subject id and title', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0].id).toMatch(/^\d+$/);
    expect(items[0].title.length).toBeGreaterThan(0);
  });
  it('throws ParseError instead of returning [] when no rows match', () => {
    expect(() => parseMovieComingChart('<html><body><div>no table</div></body></html>')).toThrow(ParseError);
  });
});
