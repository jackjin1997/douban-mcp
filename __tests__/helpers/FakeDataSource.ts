import type {
  IDoubanDataSource,
  SubjectSummary,
  MovieDetail,
  MovieChartKind,
  Review,
  BookDetail,
  BookChartKind,
  Collection,
  CollectionStatus,
  Doulist,
  UserProfile,
  MarkOptions,
} from '../../src/datasources/types.js';

export class FakeDataSource implements IDoubanDataSource {
  public marks: Array<{ category: string; id: string; status: CollectionStatus; options: MarkOptions }> = [];
  public unmarks: Array<{ category: string; id: string }> = [];

  constructor(public overrides: Partial<IDoubanDataSource> = {}) {}

  getCurrentUser = jest.fn(async (): Promise<UserProfile | null> =>
    this.overrides.getCurrentUser
      ? this.overrides.getCurrentUser()
      : { uid: '99', name: 'TestUser', avatar: '' });

  searchMovie = jest.fn(async (q: string, count: number): Promise<SubjectSummary[]> =>
    this.overrides.searchMovie
      ? this.overrides.searchMovie(q, count)
      : Array.from({ length: count }, (_, i) => ({
          id: `m${i}`,
          title: `${q} ${i}`,
          year: '2020',
          rating: 8 + i * 0.1,
          url: `https://movie.douban.com/subject/m${i}/`,
        })));

  getMovie = jest.fn(async (id: string): Promise<MovieDetail> =>
    this.overrides.getMovie
      ? this.overrides.getMovie(id)
      : ({
          id,
          title: `Movie ${id}`,
          year: '2020',
          rating: 8.5,
          ratingCount: 100,
          url: `https://movie.douban.com/subject/${id}/`,
          directors: [{ id: 'd1', name: 'Director', url: '' }],
          casts: [{ id: 'c1', name: 'Actor', url: '' }],
          genres: ['剧情'],
          countries: ['中国'],
          summary: 'Mock summary text long enough.',
        }));

  getMovieReviews = jest.fn(async (_id: string, count: number): Promise<Review[]> =>
    Array.from({ length: count }, (_, i) => ({
      author: `user${i}`,
      authorUid: `${i}`,
      content: `comment ${i}`,
      publishedAt: '2025-01-01',
      usefulCount: i,
    })));

  getMovieChart = jest.fn(async (_kind: MovieChartKind, _start: number, count: number): Promise<SubjectSummary[]> =>
    Array.from({ length: count }, (_, i) => ({
      id: `chart${i}`,
      title: `Chart ${i}`,
      year: '2020',
      rating: 9 - i * 0.1,
      url: `https://movie.douban.com/subject/chart${i}/`,
    })));

  searchBook = jest.fn(async (q: string, count: number): Promise<SubjectSummary[]> =>
    Array.from({ length: count }, (_, i) => ({
      id: `b${i}`,
      title: `${q} ${i}`,
      rating: 7 + i * 0.1,
      url: `https://book.douban.com/subject/b${i}/`,
    })));

  getBook = jest.fn(async (id: string): Promise<BookDetail> => ({
    id,
    title: `Book ${id}`,
    rating: 8.0,
    ratingCount: 50,
    url: `https://book.douban.com/subject/${id}/`,
    authors: ['Author'],
    publisher: 'Publisher',
    publishDate: '2020-01-01',
    isbn: '9787000000000',
    summary: 'Mock book summary text.',
  }));

  getBookReviews = jest.fn(async (_id: string, count: number): Promise<Review[]> =>
    Array.from({ length: count }, (_, i) => ({
      author: `reader${i}`,
      authorUid: `${i}`,
      content: `review ${i}`,
      publishedAt: '2025-01-01',
      usefulCount: 0,
    })));

  getBookChart = jest.fn(async (_kind: BookChartKind, count: number): Promise<SubjectSummary[]> =>
    Array.from({ length: count }, (_, i) => ({
      id: `bc${i}`,
      title: `Book Chart ${i}`,
      rating: 8 + i * 0.1,
      url: `https://book.douban.com/subject/bc${i}/`,
    })));

  getUserCollections = jest.fn(async (
    _uid: string | null,
    _category: 'movie' | 'book',
    status: CollectionStatus,
    _start: number,
    count: number,
  ): Promise<Collection[]> =>
    Array.from({ length: count }, (_, i) => ({
      subject: { id: `s${i}`, title: `Subject ${i}`, url: '' },
      status,
      rating: 4,
      comment: `note ${i}`,
      tags: ['tag1'],
      markedAt: '2025-01-01',
    })));

  getUserDoulist = jest.fn(async (_uid: string | null): Promise<Doulist[]> => [
    { id: '1', title: 'List 1', description: 'desc', itemCount: 10, url: 'https://www.douban.com/doulist/1/' },
  ]);

  getUserProfile = jest.fn(async (_uid: string | null): Promise<UserProfile> => ({
    uid: '99',
    name: 'TestUser',
    avatar: '',
  }));

  markSubject = jest.fn(async (
    category: 'movie' | 'book',
    id: string,
    status: CollectionStatus,
    options: MarkOptions,
  ): Promise<void> => {
    this.marks.push({ category, id, status, options });
  });

  unmarkSubject = jest.fn(async (category: 'movie' | 'book', id: string): Promise<void> => {
    this.unmarks.push({ category, id });
  });
}
