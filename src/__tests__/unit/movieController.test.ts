import { Request, Response } from "express";
import { MovieController } from "../../controllers/movieController";
import { DoubanService } from "../../services/doubanService";
import { Movie, SearchResult } from "../../types";

// 手动模拟DoubanService的实现
class MockDoubanService {
  getMovieById = jest.fn();
  searchMovies = jest.fn();
  getRecommendations = jest.fn();
}

// 直接替换DoubanService
jest.mock("../../services/doubanService", () => {
  return {
    DoubanService: jest.fn().mockImplementation(() => {
      return new MockDoubanService();
    }),
  };
});

describe("MovieController", () => {
  let movieController: MovieController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockDoubanService: MockDoubanService;

  beforeEach(() => {
    // 创建模拟的请求和响应对象
    mockRequest = {
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // 重置并创建新的控制器实例，这将使用我们的MockDoubanService
    jest.clearAllMocks();
    movieController = new MovieController();

    // 获取MockDoubanService实例
    mockDoubanService = new DoubanService() as unknown as MockDoubanService;
  });

  describe("getMovieById", () => {
    const mockMovie: Movie = {
      id: "test123",
      title: "测试电影",
      original_title: "Test Movie",
      alt: "https://movie.example.com/test123",
      images: {
        small: "small.jpg",
        medium: "medium.jpg",
        large: "large.jpg",
      },
      year: "2023",
      genres: ["剧情"],
      rating: {
        max: 10,
        average: 8.5,
        stars: "45",
        min: 0,
      },
      directors: [],
      casts: [],
      summary: "测试简介",
      subtype: "movie",
    };

    it("应正确返回电影详情", async () => {
      // 设置请求参数
      mockRequest.params = { id: "test123" };

      // 模拟服务返回
      mockDoubanService.getMovieById.mockResolvedValue(mockMovie);

      // 调用控制器方法
      await movieController.getMovieById(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 200,
        message: "success",
        data: mockMovie,
      });
    });

    it("当缺少ID参数时应返回错误", async () => {
      // 设置请求参数为空
      mockRequest.params = {};

      // 调用控制器方法
      await movieController.getMovieById(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 400,
        message: "缺少电影ID",
        data: null,
      });
    });

    it("当服务抛出异常时应返回500错误", async () => {
      // 设置请求参数
      mockRequest.params = { id: "test123" };

      // 模拟服务抛出错误
      mockDoubanService.getMovieById.mockRejectedValue(new Error("服务错误"));

      // 调用控制器方法
      await movieController.getMovieById(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 500,
        message: "获取电影详情失败",
        data: null,
      });
    });
  });

  describe("searchMovies", () => {
    const mockSearchResult: SearchResult = {
      count: 2,
      start: 0,
      total: 2,
      subjects: [
        {
          id: "movie1",
          title: "测试电影1",
          original_title: "Test Movie 1",
          alt: "https://movie.example.com/movie1",
          images: {
            small: "small1.jpg",
            medium: "medium1.jpg",
            large: "large1.jpg",
          },
          year: "2022",
          genres: ["剧情"],
          rating: {
            max: 10,
            average: 8.0,
            stars: "40",
            min: 0,
          },
          directors: [],
          casts: [],
          summary: "简介1",
          subtype: "movie",
        },
        {
          id: "movie2",
          title: "测试电影2",
          original_title: "Test Movie 2",
          alt: "https://movie.example.com/movie2",
          images: {
            small: "small2.jpg",
            medium: "medium2.jpg",
            large: "large2.jpg",
          },
          year: "2023",
          genres: ["科幻"],
          rating: {
            max: 10,
            average: 9.0,
            stars: "45",
            min: 0,
          },
          directors: [],
          casts: [],
          summary: "简介2",
          subtype: "movie",
        },
      ],
    };

    it("应正确返回搜索结果", async () => {
      // 设置请求查询参数
      mockRequest.query = {
        q: "测试",
        start: "0",
        count: "10",
      };

      // 模拟服务返回
      mockDoubanService.searchMovies.mockResolvedValue(mockSearchResult);

      // 调用控制器方法
      await movieController.searchMovies(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 200,
        message: "success",
        data: mockSearchResult,
      });
    });

    it("当缺少搜索关键词时应返回错误", async () => {
      // 设置请求查询参数（缺少q）
      mockRequest.query = {
        start: "0",
        count: "10",
      };

      // 调用控制器方法
      await movieController.searchMovies(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 400,
        message: "缺少搜索关键词",
        data: null,
      });
    });

    it("应使用默认分页参数", async () => {
      // 设置请求查询参数（只有q）
      mockRequest.query = {
        q: "测试",
      };

      // 模拟服务返回
      mockDoubanService.searchMovies.mockResolvedValue(mockSearchResult);

      // 调用控制器方法
      await movieController.searchMovies(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 200,
        message: "success",
        data: mockSearchResult,
      });
    });

    it("当服务抛出异常时应返回500错误", async () => {
      // 设置请求查询参数
      mockRequest.query = {
        q: "测试",
      };

      // 模拟服务抛出错误
      mockDoubanService.searchMovies.mockRejectedValue(new Error("服务错误"));

      // 调用控制器方法
      await movieController.searchMovies(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 500,
        message: "搜索电影失败",
        data: null,
      });
    });
  });

  describe("getRecommendations", () => {
    const mockMovies: Movie[] = [
      {
        id: "rec1",
        title: "推荐电影1",
        original_title: "Recommended Movie 1",
        alt: "https://movie.example.com/rec1",
        images: {
          small: "small1.jpg",
          medium: "medium1.jpg",
          large: "large1.jpg",
        },
        year: "2023",
        genres: ["科幻", "动作"],
        rating: {
          max: 10,
          average: 8.5,
          stars: "45",
          min: 0,
        },
        directors: [],
        casts: [],
        summary: "推荐电影1简介",
        subtype: "movie",
      },
      {
        id: "rec2",
        title: "推荐电影2",
        original_title: "Recommended Movie 2",
        alt: "https://movie.example.com/rec2",
        images: {
          small: "small2.jpg",
          medium: "medium2.jpg",
          large: "large2.jpg",
        },
        year: "2022",
        genres: ["剧情", "冒险"],
        rating: {
          max: 10,
          average: 9.0,
          stars: "45",
          min: 0,
        },
        directors: [],
        casts: [],
        summary: "推荐电影2简介",
        subtype: "movie",
      },
    ];

    it("应正确返回推荐结果", async () => {
      // 设置请求体
      mockRequest.body = {
        genres: ["科幻", "剧情"],
        year_range: "2020-2023",
        rating_range: "8-10",
        limit: 2,
      };

      // 模拟服务返回
      mockDoubanService.getRecommendations.mockResolvedValue(mockMovies);

      // 调用控制器方法
      await movieController.getRecommendations(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 200,
        message: "success",
        data: mockMovies,
      });
    });

    it("应处理字符串形式的数组参数", async () => {
      // 设置请求体
      mockRequest.body = {
        genres: "科幻,剧情",
        tags: "太空,悬疑",
      };

      // 模拟服务返回
      mockDoubanService.getRecommendations.mockResolvedValue(mockMovies);

      // 调用控制器方法
      await movieController.getRecommendations(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 200,
        message: "success",
        data: mockMovies,
      });
    });

    it("当服务抛出异常时应返回500错误", async () => {
      // 设置请求体
      mockRequest.body = {
        genres: ["科幻"],
      };

      // 模拟服务抛出错误
      mockDoubanService.getRecommendations.mockRejectedValue(
        new Error("服务错误")
      );

      // 调用控制器方法
      await movieController.getRecommendations(
        mockRequest as Request,
        mockResponse as Response
      );

      // 验证响应
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 500,
        message: "获取电影推荐失败",
        data: null,
      });
    });
  });
});
