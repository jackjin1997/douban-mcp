// 豆瓣电影类型定义
export interface Movie {
  id: string;
  title: string;
  original_title: string;
  alt: string;
  images: {
    small: string;
    medium: string;
    large: string;
  };
  year: string;
  genres: string[];
  rating: {
    max: number;
    average: number;
    stars: string;
    min: number;
  };
  directors: Person[];
  casts: Person[];
  summary: string;
  subtype: string;
}

// 人员类型定义（导演、演员等）
export interface Person {
  id: string;
  name: string;
  alt: string;
  avatars?: {
    small: string;
    medium: string;
    large: string;
  };
}

// 搜索结果类型
export interface SearchResult {
  count: number;
  start: number;
  total: number;
  subjects: Movie[];
}

// 推荐请求参数
export interface RecommendationRequest {
  genres?: string[];
  tags?: string[];
  year_range?: string;
  rating_range?: string;
  limit?: number;
}

// MCP接口响应格式
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}
