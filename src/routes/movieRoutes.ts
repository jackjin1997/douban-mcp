import { Router, Request, Response } from "express";
import { MovieController } from "../controllers/movieController";

const router = Router();
const movieController = new MovieController();

// 获取电影详情
router.get("/movie/:id", (req: Request, res: Response) => {
  return movieController.getMovieById(req, res);
});

// 搜索电影
router.get("/search", (req: Request, res: Response) => {
  return movieController.searchMovies(req, res);
});

// 获取电影推荐
router.post("/recommend", (req: Request, res: Response) => {
  return movieController.getRecommendations(req, res);
});

export default router;
