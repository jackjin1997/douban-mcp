# douban-mcp 待办与已知问题

## 已知问题

### 1. 豆瓣 PoW (Proof-of-Work) 反爬挑战

**发现于**：M2.5（2026-05-07）抓取 fixture 时

**现象**：纯 HTTP 请求 `https://movie.douban.com/subject/<id>/` 等深度详情页面，会返回 ~3KB 的 JavaScript 挑战页而非真实 HTML，需要浏览器执行 PoW 解题。`search.douban.com` 和 `movie.douban.com/top250` 等较"轻"的页面通常不触发。

**当前缓解（v1.0 采用 B 方案）**：
- HtmlDataSource 仍用 axios（无浏览器开销）
- 启动时尝试一次 warm-up 请求建立 cookie，后续请求复用 session
- 撞挑战时抛 `RateLimitError` 并提示用户配置 `DOUBAN_COOKIE` 或切 `DOUBAN_DATA_SOURCE=frodo`

**未解决的事**：
- warm-up 不一定能 100% 绕过 PoW
- 长会话（如 SSE 连接）可能 cookie 失效后再次撞挑战
- v1.x 可能需要：
  - (a) 接入 puppeteer/playwright 作为可选兜底
  - (b) 实现 PoW 算法的 JS 翻译（hash 类挑战可解）
  - (c) 把 Frodo 数据源升级为生产默认

**追踪**：实施细节见 `src/datasources/HtmlDataSource.ts` 的 httpGet（M2.9 实现）。
