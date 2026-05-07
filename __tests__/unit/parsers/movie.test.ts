import { parseMovieDetail, parseMovieSearch, parseTop250 } from '../../../src/datasources/parsers/movie.js';
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
});
