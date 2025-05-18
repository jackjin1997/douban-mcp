import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import movieRoutes from "./routes/movieRoutes";
import { logger } from "./utils/logger";

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  next();
});

// 静态文件服务 - 放在所有路由处理之前
app.use(express.static(path.join(__dirname, "../public")));

// 健康检查
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API文档重定向
app.get("/docs", (req, res) => {
  res.redirect("/api-docs.html");
});

// 客户端示例重定向
app.get("/demo", (req, res) => {
  res.redirect("/client-demo.html");
});

// API信息
app.get("/", (req, res) => {
  res.json({
    message: "豆瓣电影MCP服务",
    docs: `${req.protocol}://${req.get("host")}/docs`,
    demo: `${req.protocol}://${req.get("host")}/demo`,
    endpoints: [
      { method: "GET", path: "/api/movie/:id", description: "获取电影详情" },
      {
        method: "GET",
        path: "/api/search",
        description: "搜索电影",
        params: ["q", "start", "count"],
      },
      { method: "POST", path: "/api/recommend", description: "获取电影推荐" },
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
    logger.error("应用错误", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      code: 500,
      message: "服务器内部错误",
      data: null,
    });
  }
);

// 启动服务器
app.listen(port, () => {
  logger.info(`豆瓣电影MCP服务已启动: http://localhost:${port}`);
  logger.info(`API文档: http://localhost:${port}/docs`);
  logger.info(`客户端示例: http://localhost:${port}/demo`);
});
