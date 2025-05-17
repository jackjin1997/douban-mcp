import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import movieRoutes from "./routes/movieRoutes";

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API文档
app.get("/", (req, res) => {
  res.json({
    message: "豆瓣电影MCP服务",
    endpoints: [
      { method: "GET", path: "/movie/:id", description: "获取电影详情" },
      {
        method: "GET",
        path: "/search",
        description: "搜索电影",
        params: ["q", "start", "count"],
      },
      { method: "POST", path: "/recommend", description: "获取电影推荐" },
    ],
  });
});

// 注册路由
app.use("/api", movieRoutes);

// 错误处理中间件
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("应用错误:", err);
    res.status(500).json({
      code: 500,
      message: "服务器内部错误",
      data: null,
    });
  }
);

// 启动服务器
app.listen(port, () => {
  console.log(`豆瓣电影MCP服务已启动: http://localhost:${port}`);
});
