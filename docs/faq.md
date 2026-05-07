# FAQ

## Q1: cookie 多久过期？需要主动续期吗？

通常 30 天，但你只要继续用就会自动续。如果触发风控被强制下线，需要重新登录浏览器再复制 cookie。

## Q2: 触发风控了怎么办？

服务会自动进入域级冷却（默认 60s）。再次触发会升级到 5min 冷却，写操作会锁死整个进程 session。处理方式：
- 等冷却结束（read），或重启进程（write）
- 适当降低 `DOUBAN_*PerSec` 配置（在代码里调）
- 切换 IP（如果你在数据中心 IP 上跑）

## Q3: 这个项目和 xhs-mcp 是什么关系？

设计参考了 [jobsonlook/xhs-mcp](https://github.com/jobsonlook/xhs-mcp) 的轻量纯 MCP 路线和 [aki66938/xhs-toolkit](https://github.com/aki66938/xhs-toolkit) 的"工具包"思想。但豆瓣无 x-s/x-t 动态签名，所以更轻量（不依赖 Playwright）；同时本项目把 CLI 当作 agent native 的一等入口。

## Q4: SSE 模式怎么用？

```bash
node dist/index.js serve --transport sse --port 3000
```
然后在 MCP 客户端把 transport 配成 SSE 指向 `http://localhost:3000/sse`。

## Q5: 提示"找不到对应资源"？

- 确认 id 是数字字符串，不是 URL
- 确认资源没被豆瓣删除（浏览器打开 `https://movie.douban.com/subject/<id>/` 验证）
- 切换数据源试试：`DOUBAN_DATA_SOURCE=frodo`

## Q6: 怎么贡献？

见 [CONTRIBUTING.md](../CONTRIBUTING.md)。简单来说：
- 抓真实 HTML 存到 `__tests__/fixtures/`
- 写解析器测试 + 解析器
- 不接受手写假 HTML 的 PR

## Q7: 为什么 HTML 模式有时候返回空？

豆瓣对纯 HTTP 触发 PoW（proof-of-work）挑战，特别是 `movie.douban.com/subject/<id>/` 这类详情页。当前 v1.0 的缓解是：撞挑战时抛 `RateLimitError` + 提示用户配 cookie 或切 Frodo。详见 `docs/jack_todo.md`。

## Q8: 写操作触发"未启用"？

需要同时设置：
```bash
export DOUBAN_COOKIE="..."
export DOUBAN_ENABLE_WRITE=true
```
缺一不可。这是 secure by default。
