export type CollectionStatus = 'wish' | 'do' | 'collect';
export type MovieChartKind   = 'top250' | 'weekly' | 'new';
export type BookChartKind    = 'fiction' | 'non_fiction' | 'new';

export interface SubjectSummary {
  id: string;
  title: string;
  year?: string;
  rating?: number;
  url: string;
  cover?: string;
}

export interface Person { id: string; name: string; url: string; }

export interface MovieDetail extends SubjectSummary {
  originalTitle?: string;
  directors: Person[];
  casts: Person[];
  genres: string[];
  countries: string[];
  releaseDate?: string;
  duration?: string;
  imdbId?: string;
  summary: string;
  ratingCount: number;
  ratingDistribution?: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export interface BookDetail extends SubjectSummary {
  authors: string[];
  translators?: string[];
  publisher?: string;
  publishDate?: string;
  pages?: number;
  price?: string;
  isbn?: string;
  summary: string;
  ratingCount: number;
}

export interface Review {
  author: string;
  authorUid: string;
  rating?: number;
  content: string;
  publishedAt: string;
  usefulCount: number;
}

export interface Collection {
  subject: SubjectSummary;
  status: CollectionStatus;
  rating?: number;
  comment?: string;
  tags: string[];
  markedAt: string;
}

export interface Doulist {
  id: string; title: string; description: string; itemCount: number; url: string;
}

export interface UserProfile {
  uid: string; name: string; avatar: string; signature?: string;
  counts?: { wished: number; doing: number; collected: number };
}

export interface MarkOptions {
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  tags?: string[];
  shareToFeed?: boolean;
}

export interface IDoubanDataSource {
  getCurrentUser(): Promise<UserProfile | null>;

  searchMovie(q: string, count: number): Promise<SubjectSummary[]>;
  getMovie(id: string): Promise<MovieDetail>;
  getMovieReviews(id: string, count: number): Promise<Review[]>;
  getMovieChart(kind: MovieChartKind, start: number, count: number): Promise<SubjectSummary[]>;

  searchBook(q: string, count: number): Promise<SubjectSummary[]>;
  getBook(id: string): Promise<BookDetail>;
  getBookReviews(id: string, count: number): Promise<Review[]>;
  getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]>;

  getUserCollections(
    uid: string | null,
    category: 'movie' | 'book',
    status: CollectionStatus,
    start: number,
    count: number
  ): Promise<Collection[]>;
  getUserDoulist(uid: string | null): Promise<Doulist[]>;
  getUserProfile(uid: string | null): Promise<UserProfile>;

  markSubject(category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions): Promise<void>;
  unmarkSubject(category: 'movie' | 'book', id: string): Promise<void>;
}
