import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseBookDetail, parseBookSearch } from '../../../src/datasources/parsers/book.js';

const loadFixture = (name: string) =>
  readFileSync(resolve(process.cwd(), '__tests__', 'fixtures', name), 'utf-8');

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
