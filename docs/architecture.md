# 架构

## 分层

```
MCP client / agent  →  index.ts dispatcher  →  server-entry.ts | cli.ts
                                                      ↓
                                              tools/registry.ts (单一真理源)
                                                      ↓
                                              tools/{movie,book,user,mutation,meta}.ts
                                                      ↓
                                              formatters/markdown.ts
                                                      ↓
                                              datasources/IDoubanDataSource
                                                  ↙              ↘
                                       HtmlDataSource         FrodoDataSource
                                                  ↘              ↙
                                              cache + rate limit + cookie
                                                      ↓
                                                豆瓣（HTML / Frodo API）
```

## 单一真理源：toolRegistry

`src/tools/registry.ts` 列出每个工具的 id / cliName / mcpName / inputSchema / handler / annotations。三种入口都从这里派生：
- MCP server: `for (t of registry) server.registerTool(t.mcpName, ..., t.handler)`
- CLI: `for (t of registry) program.command(t.cliName).action(...)`
- SKILL.md: `pnpm build:skill-md` 把 registry 渲染到 `skills/douban/SKILL.md`（CI 强制无 drift）

## 错误层级

`src/errors.ts` 定义 6 类错误：
`AuthError | NotFoundError | RateLimitError | ParseError | WriteDisabledError | NetworkError`

`tools/_boundary.ts:formatError` 映射为友好中文消息（MCP 模式）；`cli/output.ts:exitCodeFor` 映射为 1/2/3/4 退出码（CLI 模式）。

## 缓存策略

| 资源 | TTL |
|---|---|
| 详情（movie/book） | 6h |
| 搜索 / 短评 | 30min |
| 榜单 | 1h |
| 自己的 collection | 5min（写操作后 invalidate） |
| 他人 collection | 30min |
| profile / doulist | 1h |

## 限速 + 风控退避

`bottleneck` 按域分桶。冷却态期间所有请求 fail-fast。冷却升级：60s → 5min。写操作触发风控会锁死整个进程 session 的写权限。
