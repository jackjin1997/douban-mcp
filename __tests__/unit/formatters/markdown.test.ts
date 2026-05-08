import {
  formatSubjectList, formatMovieDetail, formatBookDetail,
  formatReviews, formatCollections, formatDoulists, formatProfile,
  formatMarkResult,
} from '../../../src/formatters/markdown.js';

describe('formatSubjectList', () => {
  it('renders numbered list with title/rating/url', () => {
    const md = formatSubjectList([
      { id: '1', title: '电影一', year: '2020', rating: 8.5, url: 'https://movie.douban.com/subject/1/' },
    ]);
    expect(md).toMatch(/1\.\s+\*\*电影一\*\*/);
    expect(md).toContain('8.5');
    expect(md).toContain('https://movie.douban.com/subject/1/');
  });
  it('handles empty list with friendly text', () => {
    expect(formatSubjectList([])).toContain('未找到');
  });
});

describe('formatMovieDetail', () => {
  it('renders title, directors, genres, summary', () => {
    const md = formatMovieDetail({
      id: '1', title: 'Movie', year: '2020', rating: 8.5, ratingCount: 100,
      url: 'https://movie.douban.com/subject/1/', summary: 'A summary',
      directors: [{ id: 'd', name: 'Director', url: '' }],
      casts: [], genres: ['剧情'], countries: ['中国'],
    });
    expect(md).toContain('Movie');
    expect(md).toContain('剧情');
    expect(md).toContain('Director');
  });
});

describe('formatBookDetail', () => {
  it('renders authors, publisher, isbn, summary', () => {
    const md = formatBookDetail({
      id: '1', title: 'B', rating: 8, ratingCount: 100,
      url: 'https://book.douban.com/subject/1/',
      authors: ['Liu'], publisher: 'P', isbn: '12345',
      summary: 'short summary',
    });
    expect(md).toContain('B');
    expect(md).toContain('Liu');
    expect(md).toContain('P');
    expect(md).toContain('12345');
  });
});

describe('formatReviews', () => {
  it('renders numbered review list', () => {
    const md = formatReviews([
      { author: 'u1', authorUid: '1', rating: 4, content: 'good', publishedAt: '2025-01', usefulCount: 3 },
    ]);
    expect(md).toMatch(/1\.\s+\*\*u1\*\*/);
    expect(md).toContain('good');
  });
  it('handles empty', () => {
    expect(formatReviews([])).toContain('暂无短评');
  });
});

describe('formatCollections', () => {
  it('renders subject + status + tags + comment', () => {
    const md = formatCollections([{
      subject: { id: '1', title: 'S', url: 'https://x' },
      status: 'collect', rating: 5, comment: 'note', tags: ['tag1'], markedAt: '2025-01',
    }]);
    expect(md).toContain('S');
    expect(md).toContain('note');
    expect(md).toContain('tag1');
  });
  it('handles empty', () => {
    expect(formatCollections([])).toContain('为空');
  });
});

describe('formatDoulists', () => {
  it('renders doulist titles + count', () => {
    const md = formatDoulists([{
      id: '1', title: 'L1', description: 'd', itemCount: 10, url: 'https://x',
    }]);
    expect(md).toContain('L1');
    expect(md).toContain('10');
  });
  it('handles empty', () => {
    expect(formatDoulists([])).toContain('没有公开豆列');
  });
});

describe('formatProfile', () => {
  it('renders name + uid', () => {
    const md = formatProfile({ uid: '99', name: 'TestUser', avatar: '' });
    expect(md).toContain('TestUser');
    expect(md).toContain('99');
  });
});

describe('formatMarkResult', () => {
  it('renders mark with category zh', () => {
    expect(formatMarkResult('mark', 'movie', '1234')).toContain('已标记');
    expect(formatMarkResult('mark', 'movie', '1234')).toContain('电影');
    expect(formatMarkResult('unmark', 'book', '5678')).toContain('已取消标记');
    expect(formatMarkResult('unmark', 'book', '5678')).toContain('图书');
  });
});
