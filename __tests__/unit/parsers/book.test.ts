import { parseBookDetail, parseBookSearch, parseBookTagList, parseBookLatest } from '../../../src/datasources/parsers/book.js';
import { ParseError } from '../../../src/errors.js';
import { loadFixture } from '../../helpers/loadFixture.js';

describe('parseBookDetail (三体)', () => {
  const book = parseBookDetail(loadFixture('book/three-body.html'), '2567698');
  it('extracts title and authors', () => {
    expect(book.title).toContain('三体');
    expect(book.authors.length).toBeGreaterThan(0);
  });
  it('extracts publisher and isbn', () => {
    expect(book.publisher).toBeTruthy();
    expect(book.isbn).toMatch(/^[\d-]{10,17}$/);
  });
  it('extracts numeric rating', () => {
    expect(book.rating).toBeGreaterThan(0);
  });
  it('extracts non-empty summary', () => {
    expect(book.summary.length).toBeGreaterThan(20);
  });
});

describe('parseBookSearch', () => {
  const items = parseBookSearch(loadFixture('book/search-three-body.html'));
  it('returns at least one item with id and title', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^\d+$/);
  });
});

describe('parseBookTagList (book.douban.com/tag/小说)', () => {
  const items = parseBookTagList(loadFixture('book/tag-fiction.html'));
  it('returns one item per li.subject-item', () => {
    expect(items.length).toBe(20);
  });
  it('extracts id/title/url/rating/cover from the first item', () => {
    expect(items[0]).toMatchObject({
      id: '38370177',
      title: '秦二世必须死',
      url: 'https://book.douban.com/subject/38370177/',
      rating: 6.7,
    });
    expect(items[0].cover).toMatch(/^https:\/\/img/);
  });
  it('every item has a numeric id and non-empty title', () => {
    for (const it of items) {
      expect(it.id).toMatch(/^\d+$/);
      expect(it.title.length).toBeGreaterThan(0);
    }
  });
  it('throws ParseError instead of returning [] when the list is missing', () => {
    expect(() => parseBookTagList('<html><body><h1>豆瓣读书</h1></body></html>')).toThrow(ParseError);
  });
});

describe('parseBookLatest (book.douban.com/latest 新书速递)', () => {
  const items = parseBookLatest(loadFixture('book/latest.html'));
  it('returns the chart-dashed-list entries', () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
  });
  it('extracts id/title/url/rating from the first item', () => {
    expect(items[0]).toMatchObject({
      id: '38522388',
      url: 'https://book.douban.com/subject/38522388/',
      rating: 7.4,
    });
    expect(items[0].title).toContain('何以近代');
  });
  it('throws ParseError instead of returning [] when the list is missing', () => {
    expect(() => parseBookLatest('<html><body></body></html>')).toThrow(ParseError);
  });
});
