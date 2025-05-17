import { Request, Response } from "express";
import { DoubanService } from "../services/doubanService";
import { ApiResponse, RecommendationRequest } from "../types";

const doubanService = new DoubanService();

export class MovieController {
  constructor() {
    // 绑定this上下文
    this.getMovieById = this.getMovieById.bind(this);
    this.searchMovies = this.searchMovies.bind(this);
    this.getRecommendations = this.getRecommendations.bind(this);
  }

  // 获取电影详情
  async getMovieById(req: Request, res: Response) {
    try {
      const movieId = req.params.id;

      if (!movieId) {
        return res.status(400).json({
          code: 400,
          message: "缺少电影ID",
          data: null,
        });
      }

      const movie = await doubanService.getMovieById(movieId);

      return res.json({
        code: 200,
        message: "success",
        data: movie,
      });
    } catch (error) {
      console.error("获取电影详情失败:", error);
      return res.status(500).json({
        code: 500,
        message: "获取电影详情失败",
        data: null,
      });
    }
  }

  // 搜索电影
  async searchMovies(req: Request, res: Response) {
    try {
      const { q, start = "0", count = "20" } = req.query;

      if (!q) {
        return res.status(400).json({
          code: 400,
          message: "缺少搜索关键词",
          data: null,
        });
      }

      const result = await doubanService.searchMovies(
        q as string,
        parseInt(start as string),
        parseInt(count as string)
      );

      return res.json({
        code: 200,
        message: "success",
        data: result,
      });
    } catch (error) {
      console.error("搜索电影失败:", error);
      return res.status(500).json({
        code: 500,
        message: "搜索电影失败",
        data: null,
      });
    }
  }

  // 获取电影推荐
  async getRecommendations(req: Request, res: Response) {
    try {
      // 从请求体中获取推荐参数
      const params: RecommendationRequest = req.body;

      // 处理数组类型参数
      if (typeof params.genres === "string") {
        params.genres = (params.genres as string).split(",");
      }

      if (typeof params.tags === "string") {
        params.tags = (params.tags as string).split(",");
      }

      // 获取推荐电影
      const movies = await doubanService.getRecommendations(params);

      return res.json({
        code: 200,
        message: "success",
        data: movies,
      });
    } catch (error) {
      console.error("获取电影推荐失败:", error);
      return res.status(500).json({
        code: 500,
        message: "获取电影推荐失败",
        data: null,
      });
    }
  }
}
