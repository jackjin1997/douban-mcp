import axios from "axios";
import { Movie, SearchResult, RecommendationRequest } from "../types";
import * as dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const API_BASE_URL =
  process.env.DOUBAN_API_BASE_URL || "https://api.douban.com/v2";
const API_KEY = process.env.DOUBAN_API_KEY || "";

// 创建axios实例
const doubanApi = axios.create({
  baseURL: API_BASE_URL,
  params: {
    apikey: API_KEY,
  },
});

export class DoubanService {
  // 获取电影详情
  async getMovieById(id: string): Promise<Movie> {
    try {
      logger.info(`获取电影详情服务，ID: ${id}`);
      // 注意：由于豆瓣API限制，这里使用模拟数据
      // 在实际应用中，应该使用：
      // const response = await doubanApi.get(`/movie/subject/${id}`);
      // return response.data;

      // 模拟API调用延迟
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 返回模拟数据
      const movie = this.getMockMovieById(id);
      logger.debug(`获取电影详情成功: ${movie.title}`);
      return movie;
    } catch (error) {
      logger.error("获取电影详情失败", error);
      throw new Error("获取电影详情失败");
    }
  }

  // 搜索电影
  async searchMovies(
    query: string,
    start: number = 0,
    count: number = 20
  ): Promise<SearchResult> {
    try {
      logger.info(
        `搜索电影服务，关键词: ${query}, 起始位置: ${start}, 数量: ${count}`
      );
      // 注意：由于豆瓣API限制，这里使用模拟数据
      // 在实际应用中，应该使用：
      // const response = await doubanApi.get('/movie/search', {
      //   params: { q: query, start, count }
      // });
      // return response.data;

      // 模拟API调用延迟
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 返回模拟数据
      const results = this.getMockSearchResults(query, start, count);
      logger.debug(`搜索电影成功，共 ${results.subjects.length} 条结果`);
      return results;
    } catch (error) {
      logger.error("搜索电影失败", error);
      throw new Error("搜索电影失败");
    }
  }

  // 获取推荐电影
  async getRecommendations(params: RecommendationRequest): Promise<Movie[]> {
    try {
      logger.info("获取电影推荐服务", params);
      // 注意：由于豆瓣API限制，这里使用模拟数据
      // 模拟API调用延迟
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 返回模拟数据
      const recommendations = this.getMockRecommendations(params);
      logger.debug(`获取电影推荐成功，共 ${recommendations.length} 部电影`);
      return recommendations;
    } catch (error) {
      logger.error("获取电影推荐失败", error);
      throw new Error("获取电影推荐失败");
    }
  }

  // 以下是模拟数据方法，仅用于开发测试

  private getMockMovieById(id: string): Movie {
    return {
      id,
      title: `模拟电影 ${id}`,
      original_title: `Mock Movie ${id}`,
      alt: `https://movie.douban.com/subject/${id}/`,
      images: {
        small: `https://img1.doubanio.com/view/photo/s_ratio_poster/public/${id}.jpg`,
        medium: `https://img1.doubanio.com/view/photo/m_ratio_poster/public/${id}.jpg`,
        large: `https://img1.doubanio.com/view/photo/l_ratio_poster/public/${id}.jpg`,
      },
      year: "2023",
      genres: ["剧情", "科幻"],
      rating: {
        max: 10,
        average: 8.5,
        stars: "45",
        min: 0,
      },
      directors: [
        {
          id: "director1",
          name: "模拟导演",
          alt: "https://movie.douban.com/celebrity/director1/",
        },
      ],
      casts: [
        {
          id: "actor1",
          name: "模拟演员1",
          alt: "https://movie.douban.com/celebrity/actor1/",
        },
        {
          id: "actor2",
          name: "模拟演员2",
          alt: "https://movie.douban.com/celebrity/actor2/",
        },
      ],
      summary:
        "这是一个模拟的电影简介，用于开发测试。这部电影讲述了一个引人入胜的故事...",
      subtype: "movie",
    };
  }

  private getMockSearchResults(
    query: string,
    start: number,
    count: number
  ): SearchResult {
    const total = 50; // 模拟总结果数

    const movies: Movie[] = [];
    for (let i = 0; i < Math.min(count, total - start); i++) {
      const mockId = `mock${start + i}`;
      movies.push({
        ...this.getMockMovieById(mockId),
        title: `${query}相关电影 ${start + i}`,
      });
    }

    return {
      count: movies.length,
      start,
      total,
      subjects: movies,
    };
  }

  private getMockRecommendations(params: RecommendationRequest): Movie[] {
    const limit = params.limit || 10;
    const movies: Movie[] = [];

    // 根据传入的genres筛选
    const genres = params.genres || ["剧情", "科幻", "动作", "冒险"];

    for (let i = 0; i < limit; i++) {
      const mockId = `rec${i}`;
      const mockGenres = genres.slice(0, Math.min(2, genres.length));

      // 创建基础电影对象
      const movie = this.getMockMovieById(mockId);

      // 根据请求参数修改一些属性
      movie.title = `推荐电影 ${i}`;
      movie.genres = mockGenres;

      if (params.year_range) {
        // 假设year_range格式为 "2010-2020"
        const [minYear, maxYear] = params.year_range.split("-");
        const year =
          Math.floor(
            Math.random() * (parseInt(maxYear) - parseInt(minYear) + 1)
          ) + parseInt(minYear);
        movie.year = year.toString();
      }

      if (params.rating_range) {
        // 假设rating_range格式为 "7-10"
        const [minRating, maxRating] = params.rating_range.split("-");
        const rating = (
          Math.random() * (parseFloat(maxRating) - parseFloat(minRating)) +
          parseFloat(minRating)
        ).toFixed(1);
        movie.rating.average = parseFloat(rating);
      }

      movies.push(movie);
    }

    return movies;
  }
}
