import request from "supertest";
import express from "express";
import cors from "cors";
import movieRoutes from "../../routes/movieRoutes";
import { DoubanService } from "../../services/doubanService";
import { Movie, SearchResult } from "../../types";

// 模拟DoubanService
jest.mock("../../services/doubanService", () => {
  return {
    DoubanService: jest.fn().mockImplementation(() => {
      return {
        getMovieById: jest.fn(),
        searchMovies: jest.fn(),
        getRecommendations: jest.fn(),
      };
    }),
  };
});

describe("API Integration Tests", () => {
  let app: express.Application;
  let mockDoubanService: any;

  beforeAll(() => {
    // 创建Express应用
    app = express();

    // 添加中间件
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 注册路由
    app.use("/api", movieRoutes);

    // 获取DoubanService的模拟实例
    mockDoubanService = new DoubanService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/movie/:id", () => {
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

    it("应返回正确的响应格式", async () => {
      // 模拟服务返回
      mockDoubanService.getMovieById.mockResolvedValue(mockMovie);

      // 发送请求
      const response = await request(app)
        .get("/api/movie/test123")
        .expect("Content-Type", /json/);

      // 验证状态码
      expect(response.status).toBe(200);

      // 验证响应结构
      expect(response.body).toHaveProperty("code", 200);
      expect(response.body).toHaveProperty("message", "success");
      expect(response.body).toHaveProperty("data");
    });
  });

  describe("GET /api/search", () => {
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

    it("应返回正确的响应格式", async () => {
      // 模拟服务返回
      mockDoubanService.searchMovies.mockResolvedValue(mockSearchResult);

      // 发送请求
      const response = await request(app)
        .get("/api/search?q=测试&start=0&count=10")
        .expect("Content-Type", /json/);

      // 验证状态码
      expect(response.status).toBe(200);

      // 验证响应结构
      expect(response.body).toHaveProperty("code", 200);
      expect(response.body).toHaveProperty("message", "success");
      expect(response.body).toHaveProperty("data");
    });

    it("当缺少搜索关键词时应返回400错误", async () => {
      // 发送请求
      const response = await request(app)
        .get("/api/search")
        .expect("Content-Type", /json/);

      // 验证状态码
      expect(response.status).toBe(400);

      // 验证响应
      expect(response.body).toHaveProperty("code", 400);
      expect(response.body).toHaveProperty("message", "缺少搜索关键词");
      expect(response.body).toHaveProperty("data", null);
    });
  });

  describe("POST /api/recommend", () => {
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

    it("应返回正确的响应格式", async () => {
      // 模拟服务返回
      mockDoubanService.getRecommendations.mockResolvedValue(mockMovies);

      // 请求参数
      const params = {
        genres: ["科幻", "剧情"],
        year_range: "2020-2023",
        rating_range: "8-10",
        limit: 2,
      };

      // 发送请求
      const response = await request(app)
        .post("/api/recommend")
        .send(params)
        .expect("Content-Type", /json/);

      // 验证状态码
      expect(response.status).toBe(200);

      // 验证响应结构
      expect(response.body).toHaveProperty("code", 200);
      expect(response.body).toHaveProperty("message", "success");
      expect(response.body).toHaveProperty("data");
    });

    it("应处理字符串形式的数组参数", async () => {
      // 模拟服务返回
      mockDoubanService.getRecommendations.mockResolvedValue(mockMovies);

      // 请求参数
      const params = {
        genres: "科幻,剧情",
        tags: "太空,悬疑",
      };

      // 发送请求
      const response = await request(app)
        .post("/api/recommend")
        .send(params)
        .expect("Content-Type", /json/);

      // 验证状态码
      expect(response.status).toBe(200);

      // 验证响应结构
      expect(response.body).toHaveProperty("code", 200);
      expect(response.body).toHaveProperty("message", "success");
      expect(response.body).toHaveProperty("data");
    });
  });
});
