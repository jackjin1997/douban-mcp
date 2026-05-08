# douban-mcp v1.0 设计规格

| 字段 | 值 |
|---|---|
| 日期 | 2026-05-07 |
| 作者 | JackJin |
| 状态 | Approved（待实施） |
| 参考项目 | [jobsonlook/xhs-mcp](https://github.com/jobsonlook/xhs-mcp)、[aki66938/xhs-toolkit](https://github.com/aki66938/xhs-toolkit) |
| 关联 brainstorm | 2026-05-07 会话 |

---

## 0. 摘要

把当前的 `douban-mcp` 项目（一个名字叫 MCP 但实际是 Express REST API + 全 mock 数据的伪 MCP）重写为一个**完整的、对标 xhs-mcp 体量、面向 agent 的豆瓣访问层**。

v1.0 同时交付三种使用形态：

1. **MCP server**（stdio + SSE）— 给 Claude Desktop / Cursor / Cline 等 MCP 客户端用
2. **agent 友好的 CLI** — 给 Claude Code / OpenClaw / 任何能跑 Bash 的 agent 用
3. **Claude Code Skill 包**（`skills/douban/SKILL.md`） — 教 agent 如何使用上面这套 CLI

底层：分层架构（datasources → tools → server/cli），单一工具注册表派生三种入口，避免 schema 漂移。

---

## 1. 背景与目标

### 1.1 现状问题

当前 `douban-mcp`：

- **不是 MCP**：依赖里没有 `@modelcontextprotocol/sdk`，是 Express + REST API。
- **数据全 mock**：`getMockMovieById` / `getMockSearchResults` 等函数返回拼接字符串，没有任何真实抓取代码。
- **能力极少**：仅 `movie` 域的 `detail/search/recommend` 三个接口，无图书、无用户态、无写操作。

### 1.2 v1.0 目标

| 目标 | 衡量标准 |
|---|---|
| 真正的 MCP 协议实现 | 在 Claude Desktop 配置中加载并通过 `tools/list` 看到 12+ 工具 |
| 真实数据接入 | 每个工具能返回真实豆瓣数据，无 mock |
| 三种形态共存 | 同一个 npm 包，既能 `serve`，又能 `call`，又能装 skill |
| 可发布到 npm | `npx -y douban-mcp` 一行启动 |
| 测试覆盖率 ≥ 80% | CI 强制 fail under 80% |
| 文档完整 | README + cookie 教程 + FAQ + 架构文档 + 贡献指南 + spec |

### 1.3 演进路径

| 版本 | 计划 |
|---|---|
| v1.0 | 16 个工具（12 读 + 4 写）+ HTML + Frodo 双数据源 + CLI + Skill |
| v1.1 | 覆盖率提到 90%+，新增 `search_user` / `get_doulist_items` / `get_book_excerpt` |
| v1.2 | 短评写操作 `post_short_review`、tags 修改 |
| v2.0 | Python 平行 SDK（保持 MCP 协议契约一致） |

### 1.4 v1.0 内部 milestone 拆分（供 writing-plans 参考）

| Milestone | 范围 | 可独立交付 |
|---|---|---|
| M1 协议骨架 | 删旧 Express 代码；引入 `@modelcontextprotocol/sdk`；最小 stdio MCP server 跑通 + 1 个 hello 工具；CI 框架 | 是（功能为零，但跑得起来） |
| M2 数据源层 | `IDoubanDataSource` 接口 + 类型 + 错误层级；`HtmlDataSource` 完整实现 + 解析器 + fixture 单测；缓存 + 限速 | 是（命令行单测可验） |
| M3 工具层 | `toolRegistry` + 12 个读工具 + L1 集成测试；`withErrorBoundary`；formatter | 是（MCP server 实用） |
| M4 鉴权 + 写 | CookieManager；启动期自检 + 双模式注册；4 个写工具；写操作的 L1/L2 测试 | 是（功能完备） |
| M5 CLI + Skill | `cli.ts` 子命令派生；`--json` 输出协议；`build-skill-md` 脚本 + SKILL.md；CLI 的 L2 e2e 测试 | 是（agent 可用） |
| M6 Frodo + SSE | `FrodoDataSource` 完整实现；SSE transport；factory 切换 | 是（双数据源 + 双 transport） |
| M7 文档与发布 | README / FAQ / cookie 教程 / 架构文档 / examples / nightly 工作流；`npm publish` | 是（v1.0 GA） |

---

## 2. 范围

### 2.1 范围内（v1.0 必出）

- 电影域：搜索 / 详情 / 短评 / 榜单
- 图书域：搜索 / 详情 / 短评 / 榜单
- 用户态：他人/自己的"想看/在看/看过"列表 / 豆列 / profile
- 写操作：电影/图书的标记（含可选打分、可选评论、可选 tags、可选广播同步）
- 数据源：HTML（默认）+ Frodo（可选切换）
- 缓存层、限速层、错误处理层
- MCP server（stdio + SSE）
- agent 友好 CLI（人类模式 + `--json` 模式）
- Claude Code skill 包
- 完整文档套件（README / cookie 教程 / FAQ / 架构 / 贡献指南）
- CI / 自动发布到 npm

### 2.2 范围外（v1.x 或之后）

- 短评 / 长评 / 广播 / 日记的写操作
- 音乐 / 同城 / 小组 / 播客域
- 数据导出（CSV / JSON 大批量）— xhs-toolkit 风格的"创作者数据采集"不做
- 交互式 TUI 菜单
- Python 实现
- Plugin 系统（让第三方加新域）

---

## 3. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│           Claude Desktop / Cursor / Cline   |   Claude Code /    │
│           (MCP clients)                     |   OpenClaw / agent │
└──────────────────┬─────────────────────────────┬─────────────────┘
                   │ stdio JSON-RPC / SSE        │ Bash exec
┌──────────────────▼─────────────────────────────▼─────────────────┐
│  Entry: src/index.ts                                              │
│  ├─ subcommand=serve  → MCP server (stdio | sse)                  │
│  └─ subcommand=*      → CLI (call | check | doctor | …)           │
└──────────────────┬────────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  tools/registry.ts —— 单一工具真理源                              │
│    每条 entry: { id, cliName, mcpName, description,              │
│                  inputSchema(zod), readOnly, requiresAuth,       │
│                  handler }                                       │
│    → 自动派生 MCP 工具 + CLI 子命令 + SKILL.md 段落              │
└──────────────────┬────────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  tools/{movie,book,user,mutation,meta}.ts                         │
│    handler 只做：参数校验 → 调 datasource → 调 formatter → 返回  │
└──────────────────┬────────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  formatters/markdown.ts                                           │
│    纯函数：结构化数据 → markdown 字符串                          │
└──────────────────┬────────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  datasources/                                                     │
│  ├─ types.ts          IDoubanDataSource 接口                     │
│  ├─ HtmlDataSource    axios + cheerio                            │
│  ├─ FrodoDataSource   httpx + apikey                             │
│  ├─ parsers/          按页面拆分的 cheerio 解析器                │
│  └─ factory.ts        根据 DOUBAN_DATA_SOURCE 选择实现           │
└──────────────────┬────────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  横切：cache (node-cache) | auth (cookie) | rateLimit | logger    │
└──────────────────────────────────────────────────────────────────┘
```

**模块职责约束**：

- 每个文件 **<200 行**；超出说明职责过宽，需拆分。
- `server.ts` / `cli.ts` 不直接知道任何业务逻辑，只做协议适配。
- `tools/*.ts` 只面对 `IDoubanDataSource` 接口，不直接发 HTTP。
- `datasources/*` 是唯一"知道豆瓣是什么"的层。

---

## 4. MCP 工具清单 v1.0

### 4.1 通用（1）

| Tool | 参数 | 鉴权 | 返回 |
|---|---|---|---|
| `check_cookie` | — | 仅当 cookie 配置时注册 | "cookie 有效（用户：xxx）" / "cookie 已失效" |

### 4.2 电影域（4）

| Tool | 参数 | 鉴权 | 返回 |
|---|---|---|---|
| `search_movie` | `q: string`, `count?: 1-20=10` | 无 | markdown 列表（标题/年份/评分/导演/链接） |
| `get_movie` | `id: string` | 无 | markdown 详情（含简介、演职员、评分分布、标签） |
| `get_movie_reviews` | `id: string`, `count?: 1-20=10` | 无 | 短评列表 |
| `get_movie_chart` | `kind: "top250" \| "weekly" \| "new"`, `start?: 0`, `count?: 10` | 无 | 榜单 |

### 4.3 图书域（4）

| Tool | 参数 | 鉴权 | 返回 |
|---|---|---|---|
| `search_book` | `q: string`, `count?: 1-20=10` | 无 | 搜索结果 |
| `get_book` | `id: string` | 无 | 详情（作者/出版/简介/目录/评分分布） |
| `get_book_reviews` | `id: string`, `count?: 1-20=10` | 无 | 短评列表 |
| `get_book_chart` | `kind: "fiction" \| "non_fiction" \| "new"`, `count?: 10` | 无 | 图书榜单 |

### 4.4 用户态（3）

| Tool | 参数 | 鉴权 | 返回 |
|---|---|---|---|
| `get_user_collections` | `uid?: string`, `category: "movie" \| "book"`, `status: "wish" \| "do" \| "collect"`, `start?`, `count?` | uid 缺省时需 cookie | 列表 + 备注 + 打分 |
| `get_user_doulist` | `uid?: string` | uid 缺省时需 cookie | 豆列清单 |
| `get_user_profile` | `uid?: string` | uid 缺省时需 cookie | 用户信息（昵称/简介/想看数/看过数/常居地） |

### 4.5 写操作（仅 `DOUBAN_ENABLE_WRITE=true` 注册）（4）

| Tool | 参数 | 返回 |
|---|---|---|
| `mark_movie` | `id: string`, `status: "wish" \| "do" \| "collect"`, `rating?: 1-5`, `comment?: string`, `tags?: string[]`, `shareToFeed?: boolean=false` | success 标识 / 失败原因 |
| `unmark_movie` | `id: string` | success / 失败原因 |
| `mark_book` | `id: string`, `status`, `rating?`, `comment?`, `tags?`, `shareToFeed?: boolean=false` | success / 失败原因 |
| `unmark_book` | `id: string` | success / 失败原因 |

### 4.6 关键决策

- `mark_*` 把 status / rating / comment / tags / shareToFeed 合并到一个工具，对应豆瓣 UI 上"标记 + 打分 + 一句话短评"是一次性操作的真实流程。
- `comment` 字段是可选的，**MCP 工具描述里不引导 LLM 自动写短评**，但保留接口让用户/客户端显式传。
- `shareToFeed` 默认 `false`（不广播），更克制，避免 agent 误操作刷屏。
- `get_movie_chart` / `get_book_chart` 用 `kind` 枚举而不是拆 `get_top250` / `get_weekly` 多个工具，减少工具数量。
- 所有工具返回 **markdown 字符串**而非 JSON，对 LLM 友好（学 xhs-mcp）。`--json` 输出形式仅在 CLI 提供。

---

## 5. 数据源接口设计

### 5.1 IDoubanDataSource 接口

```ts
// src/datasources/types.ts
export interface IDoubanDataSource {
  // 通用
  getCurrentUser(): Promise<UserProfile | null>;

  // 电影
  searchMovie(q: string, count: number): Promise<SubjectSummary[]>;
  getMovie(id: string): Promise<MovieDetail>;
  getMovieReviews(id: string, count: number): Promise<Review[]>;
  getMovieChart(kind: MovieChartKind, start: number, count: number): Promise<SubjectSummary[]>;

  // 图书
  searchBook(q: string, count: number): Promise<SubjectSummary[]>;
  getBook(id: string): Promise<BookDetail>;
  getBookReviews(id: string, count: number): Promise<Review[]>;
  getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]>;

  // 用户态
  getUserCollections(
    uid: string | null,                 // null 表示当前登录用户
    category: 'movie' | 'book',
    status: CollectionStatus,
    start: number,
    count: number
  ): Promise<Collection[]>;
  getUserDoulist(uid: string | null): Promise<Doulist[]>;
  getUserProfile(uid: string | null): Promise<UserProfile>;

  // 写操作
  markSubject(
    category: 'movie' | 'book',
    id: string,
    status: CollectionStatus,
    options: MarkOptions
  ): Promise<void>;
  unmarkSubject(category: 'movie' | 'book', id: string): Promise<void>;
}
```

### 5.2 类型定义

```ts
export type CollectionStatus = 'wish' | 'do' | 'collect';
export type MovieChartKind = 'top250' | 'weekly' | 'new';
export type BookChartKind = 'fiction' | 'non_fiction' | 'new';

export interface SubjectSummary {
  id: string;
  title: string;
  year?: string;
  rating?: number;
  url: string;
  cover?: string;
}

export interface MovieDetail extends SubjectSummary {
  originalTitle?: string;
  directors: Person[];
  casts: Person[];
  genres: string[];
  countries: string[];
  releaseDate?: string;
  duration?: string;
  imdbId?: string;
  summary: string;
  ratingCount: number;
  ratingDistribution?: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export interface BookDetail extends SubjectSummary {
  authors: string[];
  translators?: string[];
  publisher?: string;
  publishDate?: string;
  pages?: number;
  price?: string;
  isbn?: string;
  summary: string;
  ratingCount: number;
}

export interface Review {
  author: string;
  authorUid: string;
  rating?: number;
  content: string;
  publishedAt: string;
  usefulCount: number;
}

export interface Collection {
  subject: SubjectSummary;
  status: CollectionStatus;
  rating?: number;
  comment?: string;
  tags: string[];
  markedAt: string;
}

export interface Doulist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  url: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  avatar: string;
  signature?: string;
  counts?: { wished: number; doing: number; collected: number };
}

export interface Person { id: string; name: string; url: string; }

export interface MarkOptions {
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  tags?: string[];
  shareToFeed?: boolean;
}
```

### 5.3 错误类型层级

```ts
// src/errors.ts
export class DoubanError extends Error { code: string }
export class AuthError extends DoubanError { code = 'AUTH_FAILED' }
export class NotFoundError extends DoubanError { code = 'NOT_FOUND' }
export class RateLimitError extends DoubanError { code = 'RATE_LIMITED' }
export class ParseError extends DoubanError { code = 'PARSE_FAILED' }
export class WriteDisabledError extends DoubanError { code = 'WRITE_DISABLED' }
export class NetworkError extends DoubanError { code = 'NETWORK_ERROR' }
```

工具层用 `instanceof` 匹配后转成 LLM 友好的中文消息。CLI 层把 code 映射到标准 exit code（见 §10）。

### 5.4 两个 DataSource 实现的差异

| 能力 | HtmlDataSource | FrodoDataSource |
|---|---|---|
| 数据获取 | axios + cheerio 解析公开网页 | httpx + apikey 调 frodo.douban.com/api/v2 |
| 写操作 | 模拟表单提交 `j/subject/{id}/wish` 等 | POST 到 frodo 接口 |
| 限速 | 每域 1 req/s（读） / 1 req/3s（写） | 每域 2 req/s（读） / 1 req/3s（写） |
| User-Agent | 真实 Chrome UA + 合理 Referer | 移动端 UA |
| 触发风控时 | 拿到验证码页 → `RateLimitError` | 401/403 → `RateLimitError` |
| 实现工作量 | ~1000 行（含 5+ 种页面解析器） | ~600 行（API 已结构化） |

**v1.0 两个实现都做完整版**。`factory.ts` 根据 `DOUBAN_DATA_SOURCE=html|frodo`（默认 `html`）选择。

---

## 6. 认证 + 双模式启动

### 6.1 三种运行态

| 启动态 | 触发条件 | 注册的工具 | 适用场景 |
|---|---|---|---|
| 匿名只读 | 无 `DOUBAN_COOKIE` | 仅"无须登录"的工具，`get_user_*` 必填 `uid` | 任何人 `npx -y douban-mcp` 即可 |
| 登录只读 | 有 `DOUBAN_COOKIE`，无 `DOUBAN_ENABLE_WRITE` | 上面 + `check_cookie` + `get_user_*` 的 `uid` 可省略 | 想查自己"想看/看过"列表 |
| 登录读写 | `DOUBAN_COOKIE` + `DOUBAN_ENABLE_WRITE=true` | 上面 + `mark_*` / `unmark_*` 写操作 | 让 agent 替你标记 |

### 6.2 启动流程

```ts
// src/server.ts (片段)
async function startServer() {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';

  if (enableWrite && !cookie) {
    throw new Error('DOUBAN_ENABLE_WRITE=true requires DOUBAN_COOKIE to be set.');
  }

  const dataSource = createDataSource({
    cookie,
    sourceKind: process.env.DOUBAN_DATA_SOURCE ?? 'html',
    cache: createCache(),
    rateLimiter: createRateLimiter(),
  });

  // 启动期 cookie 自检：失效则 warn + 降级匿名
  if (cookie) {
    const me = await dataSource.getCurrentUser().catch(() => null);
    if (!me) {
      logger.warn('DOUBAN_COOKIE 已配置但似乎已失效，将以匿名模式启动。');
    } else {
      logger.info(`已登录：${me.name} (${me.uid})`);
    }
  }

  const server = new McpServer({ name: 'douban-mcp', version: pkg.version });
  registerReadTools(server, dataSource);
  if (cookie)      registerAuthRequiredTools(server, dataSource);
  if (enableWrite) registerWriteTools(server, dataSource);

  const transport = parseTransport();   // stdio | sse
  await server.connect(transport);
}
```

### 6.3 Cookie 处理

```ts
// src/auth/CookieManager.ts
export class CookieManager {
  constructor(private rawCookie: string | undefined) {}
  toHeader(): string { return this.rawCookie ?? ''; }
  getCkToken(): string | null {
    const m = this.rawCookie?.match(/(?:^|;\s*)ck=([^;]+)/);
    return m?.[1] ?? null;
  }
  getOwnUid(): string | null {
    const m = this.rawCookie?.match(/(?:^|;\s*)dbcl2="?(\d+):/);
    return m?.[1] ?? null;
  }
  hasLogin(): boolean { return !!this.getOwnUid(); }
}
```

### 6.4 安全 / 隐私

- Cookie **永不打日志**，全局 logger 中间件对 `dbcl2` / `bid` / `ck` 做关键字脱敏。
- 写操作每次执行前调用 `CookieManager.hasLogin()`，cookie 中途失效立即抛 `AuthError`。
- 错误消息不回传 cookie 值。
- README 必须有"封号风险"免责声明，参考 xhs-mcp 风格。

### 6.5 MCP 工具的 `annotations`

读工具加 `annotations: { readOnlyHint: true }`；写工具加 `annotations: { destructiveHint: true }`。这是 MCP SDK 原生能力，便于客户端对写操作做更严格的确认提示。

---

## 7. 缓存 + 限速 + 错误处理

### 7.1 缓存（`node-cache`）

| 缓存对象 | TTL | invalidation |
|---|---|---|
| `getMovie` / `getBook` 详情 | 6h | 永不 |
| `searchMovie` / `searchBook` | 30min | 永不 |
| `getMovieReviews` / `getBookReviews` | 30min | 永不 |
| `getMovieChart` / `getBookChart` | 1h | 永不 |
| `getUserProfile` | 1h | 永不 |
| `getUserCollections`（自己） | 5min | mark/unmark 后清掉自己所有 collections key |
| `getUserCollections`（他人） | 30min | 永不 |
| `getUserDoulist` | 1h | 永不 |
| `getCurrentUser` | 5min | 永不 |
| 写操作结果 | 不缓存 | — |

cache key 形式：`{datasource}:{method}:{sha1(JSON.stringify(args))}`。

`DOUBAN_DISABLE_CACHE=true` 完全关闭。

### 7.2 限速（`bottleneck`）

```
domain                                 reads        writes
─────────────────────────────────────────────────────────
movie.douban.com / book.douban.com /
  www.douban.com                       1 req/s      1 req/3s
frodo.douban.com                       2 req/s      1 req/3s
```

风控退避：

- 检测到验证码页 / 401 / 403 → 当前域进入冷却态 60s。**冷却态期间，发往该域的任何请求直接 fail-fast 抛 `RateLimitError`，不排队、不重试**。
- 冷却态结束后第一个请求若再次命中风控 → 升级冷却 5min。
- 写操作触发风控 → 锁死本次进程 session 的写权限（即使后续 cookie 重连也不解锁，需要重启进程），避免连环触发。

### 7.3 错误处理与失败诊断

工具 handler 套统一 `withErrorBoundary`：

```ts
// src/tools/_boundary.ts
export function withErrorBoundary<TArgs, TResult>(
  handler: (args: TArgs) => Promise<TResult>,
  ctx: { dataSource: IDoubanDataSource }
) {
  return async (args: TArgs) => {
    try { return { content: [{ type: 'text', text: await handler(args) }] }; }
    catch (e) {
      const msg = formatError(e, ctx);
      return { content: [{ type: 'text', text: msg }], isError: true };
    }
  };
}

function formatError(e: unknown, ctx: { dataSource: IDoubanDataSource }): string {
  if (e instanceof AuthError) return '❌ 豆瓣 cookie 已失效。请更新 DOUBAN_COOKIE 环境变量后重启 MCP 服务。';
  if (e instanceof NotFoundError) return '❌ 找不到对应资源（id 不存在或已删除）。';
  if (e instanceof RateLimitError) return '⚠️ 触发豆瓣访问限流，请等待 1 分钟后重试。';
  if (e instanceof ParseError)
    return '❌ 豆瓣页面结构变化导致解析失败。请到 GitHub 提交 issue：https://github.com/jackjin1997/douban-mcp/issues';
  if (e instanceof WriteDisabledError) return '❌ 写操作未启用。请设置环境变量 DOUBAN_ENABLE_WRITE=true 并重启服务。';
  if (e instanceof NetworkError) return '⚠️ 网络错误，请检查网络后重试。';
  logger.error('未分类错误', e);
  return `❌ 未知错误：${e instanceof Error ? e.message : String(e)}`;
}
```

---

## 8. CLI 子系统（agent native）

### 8.1 命令清单

```bash
# 查询类
douban search-movie  --q <str> [--count <n>] [--json]
douban get-movie     --id <str>            [--json]
douban list-movie-reviews --id <str> [--count <n>] [--json]
douban movie-chart   --kind top250|weekly|new [--start <n>] [--count <n>] [--json]

douban search-book   --q <str> [--count <n>] [--json]
douban get-book      --id <str>            [--json]
douban list-book-reviews --id <str> [--count <n>] [--json]
douban book-chart    --kind fiction|non_fiction|new [--count <n>] [--json]

# 用户态
douban my-collections   --category movie|book --status wish|do|collect [--start] [--count] [--json]
douban my-doulist                                                       [--json]
douban user-profile     [--uid <str>]                                   [--json]
douban user-collections --uid <str> --category --status [--start] [--count] [--json]

# 写操作（需 DOUBAN_COOKIE + DOUBAN_ENABLE_WRITE）
douban mark-movie   --id <str> --status wish|do|collect [--rating 1-5] [--comment <str>] [--tags a,b] [--share]
douban unmark-movie --id <str>
douban mark-book    --id <str> --status ... [--rating] [--comment] [--tags] [--share]
douban unmark-book  --id <str>

# 元能力
douban check                    # cookie 验证 (exit 0/1)
douban doctor                   # 全面诊断（网络/数据源/限速/缓存）
douban list-tools  [--json]     # 列出所有命令
douban describe <command>       # 单命令详细 schema

# Server 模式
douban serve                            # stdio MCP server
douban serve --transport sse --port 3000
```

### 8.2 输出协议

| 维度 | 默认（人类模式） | `--json`（agent 模式） |
|---|---|---|
| 输出 | markdown，含 emoji（✅ ⭐ ⚠️） | 严格 JSON（schema 文档化） |
| 错误 | 友好中文 + 解决建议 | `{"error":{"code":"AUTH_FAILED","message":"..."}}` |
| Exit code | 总是 0 | `0` 成功 / `1` 用户错误 / `2` 资源不存在 / `3` 限流 / `4` 内部错误 |
| Logging | 写 stderr，stdout 干净给 pipe | 同 |
| 交互 prompt | 永不 | 永不 |
| stdout 末尾 | 单换行 | 单换行（jq 友好） |

### 8.3 Exit code 映射

```
DoubanError code         → exit code
─────────────────────────────────────
(success)                → 0
AUTH_FAILED              → 1
WRITE_DISABLED           → 1
NOT_FOUND                → 2
RATE_LIMITED             → 3
PARSE_FAILED             → 4
NETWORK_ERROR            → 4
(unknown)                → 4
```

### 8.4 链式调用示例

```bash
# 找出"想看"列表里评分 8 分以上的电影，全部标记为"看过"并给 5 星
douban my-collections --category movie --status wish --json \
  | jq -r '.[] | select(.subject.rating > 8) | .subject.id' \
  | xargs -I{} douban mark-movie --id {} --status collect --rating 5
```

---

## 9. Skill 包（Claude Code）

### 9.1 文件位置

仓库内 `skills/douban/SKILL.md`，发布时一同打包。用户安装：

```bash
# 用户级
cp -r skills/douban ~/.claude/skills/

# 项目级
cp -r node_modules/douban-mcp/skills/douban .claude/skills/
```

### 9.2 SKILL.md 结构

- frontmatter：`name`、`description`（含触发关键词："豆瓣 / 想看 / 在看 / 看过 / 书单 / 影单 / Top250 / 豆列"）
- 触发场景表格
- 工作流模板（搜索 + 详情聚合 / 基于个人书单的推荐 / 批量标记等 3-5 个常见模板）
- 错误处理（exit code → agent 应有的反应）
- 配置前置条件（安装 / cookie / 写权限）

### 9.3 单一真理源 → 三种入口

```ts
// src/tools/registry.ts
export const toolRegistry = [
  {
    id: 'search_movie',
    cliName: 'search-movie',
    mcpName: 'search_movie',
    description: '...',
    inputSchema: z.object({
      q: z.string(),
      count: z.number().min(1).max(20).default(10),
    }),
    readOnly: true,
    requiresAuth: false,
    handler: searchMovieHandler,
  },
  // ...
];
```

派生流程：

- **MCP server**：遍历 registry，`server.registerTool(...)` 自动注册。
- **CLI**：遍历 registry，`commander.js` 自动生成 `call <cliName>` 子命令，参数从 `inputSchema` 派生。
- **SKILL.md**：build 脚本 `pnpm build:skill-md` 把 registry 渲染为 SKILL.md 的"可用命令"段落。CI 检查 `git diff` 应为空，防漂移。

---

## 10. 配置（环境变量 + CLI 参数）

| Env / CLI | 默认 | 说明 |
|---|---|---|
| `DOUBAN_COOKIE` | — | 登录 cookie；无则匿名只读 |
| `DOUBAN_ENABLE_WRITE` | `false` | 开启写操作，需配合 cookie |
| `DOUBAN_DATA_SOURCE` | `html` | `html` \| `frodo` |
| `DOUBAN_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `DOUBAN_DISABLE_CACHE` | `false` | 关闭缓存（测试用） |
| `DOUBAN_USER_AGENT` | 内置真实 Chrome UA | 覆盖默认 UA |
| `--transport <stdio\|sse>` | `stdio` | 协议；CLI 优先 |
| `--port <number>` | `3000` | SSE 端口 |

`.env.example` 文件随仓库提供，所有变量有注释。

---

## 11. 测试策略

### 11.1 测试金字塔

| 层 | 内容 | 跑频 |
|---|---|---|
| L0 单元 | HTML 解析器（fixture-based）/ formatters / auth / cache / ratelimit | 每次保存 |
| L1 协议集成（InMemoryTransport） | 每个 MCP 工具的 happy + error path | 每次 PR |
| L2 e2e（spawn 子进程） | stdio JSON-RPC 真实通信、CLI `execa` 调用 | 每次 PR |
| L3 手动验证 | `mcp-inspector` / Claude Desktop | 发版前 |
| Smoke（nightly） | 真实 HTTP 一次 search_movie，验证选择器没失效 | 每日 02:00 UTC |

### 11.2 L1 模板

```ts
// __tests__/integration/tools/movie.test.ts
import { McpServer } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { registerMovieTools } from '../../../src/tools/movie';
import { FakeDataSource } from '../helpers/FakeDataSource';

describe('search_movie tool', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    server = new McpServer({ name: 'douban-test', version: '0.0.0' });
    registerMovieTools(server, new FakeDataSource());
    client = new Client({ name: 'test-client', version: '0.0.0' });
    const [c, s] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(c), server.server.connect(s)]);
  });

  it('returns markdown listing matched movies', async () => {
    const res = await client.callTool({
      name: 'search_movie',
      arguments: { q: '盗梦空间', count: 3 }
    });
    const text = (res.content[0] as any).text;
    expect(text).toContain('盗梦空间');
    expect(text).toMatch(/8\.\d/);
    expect(text).toMatch(/movie\.douban\.com\/subject\/\d+/);
  });

  it('returns error result when q is empty', async () => {
    const res = await client.callTool({
      name: 'search_movie',
      arguments: { q: '' }
    });
    expect(res.isError).toBe(true);
  });

  it('only registers readOnlyHint=true on read tools', async () => {
    const list = await client.listTools();
    const search = list.tools.find(t => t.name === 'search_movie');
    expect(search?.annotations?.readOnlyHint).toBe(true);
  });
});
```

### 11.3 L2（CLI）模板

```ts
// __tests__/e2e/cli.test.ts
import { execa } from 'execa';

it('search-movie --json returns valid JSON array with exit 0', async () => {
  const { stdout, exitCode } = await execa('node', ['dist/index.js', 'search-movie', '--q', 'test', '--json'],
    { env: { DOUBAN_DISABLE_CACHE: 'true' } });
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout);
  expect(Array.isArray(parsed)).toBe(true);
});

it('mark-movie without DOUBAN_ENABLE_WRITE returns exit 1', async () => {
  const { exitCode, stdout } = await execa('node', ['dist/index.js', 'mark-movie', '--id', '1', '--status', 'collect', '--json'],
    { reject: false });
  expect(exitCode).toBe(1);
  expect(JSON.parse(stdout).error.code).toBe('WRITE_DISABLED');
});
```

### 11.4 Fixture 组织

```
__tests__/
├── fixtures/
│   ├── movie/
│   │   ├── inception.html
│   │   ├── search-inception.html
│   │   └── top250.html
│   ├── book/
│   │   ├── three-body.html
│   │   └── search-three-body.html
│   └── user/
│       ├── collections-watched.html
│       └── doulist.html
├── helpers/
│   ├── FakeDataSource.ts    # IDoubanDataSource 内存实现
│   ├── makeServer.ts        # InMemoryTransport pair 工厂
│   └── loadFixture.ts
└── ...
```

Fixture 必须**真实抓取**（脱敏后），不接受手写假 HTML。

### 11.5 覆盖率目标

| 阶段 | 全局覆盖率 | 关键模块 |
|---|---|---|
| v1.0 | ≥ 80% | datasource 接口实现 / 工具集成测试 100%；HTML 解析 ≥ 50% |
| v1.x | ≥ 90% | 解析层补到 80%+ |

CI 强制 `pnpm test --coverage` 在低于阈值时失败。

### 11.6 元测试

- 遍历 `toolRegistry`，断言每个 read 工具有 `readOnlyHint: true`，每个 write 工具没有。
- 断言 SKILL.md 与 registry 一致（`pnpm build:skill-md` 后 `git diff` 为空）。

---

## 12. 工程化交付物

### 12.1 完整目录结构

```
douban-mcp/
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml
│   └── nightly.yml
├── docs/
│   ├── superpowers/specs/2026-05-07-douban-mcp-design.md
│   ├── cookie-guide.md
│   ├── faq.md
│   └── architecture.md
├── examples/
│   ├── claude-desktop-config.json
│   ├── cursor-config.json
│   └── inspector.md
├── skills/
│   └── douban/
│       └── SKILL.md
├── src/
│   ├── auth/CookieManager.ts
│   ├── cache/MemoryCache.ts
│   ├── datasources/
│   │   ├── types.ts
│   │   ├── HtmlDataSource.ts
│   │   ├── FrodoDataSource.ts
│   │   ├── parsers/{movie,book,user}.ts
│   │   └── factory.ts
│   ├── errors.ts
│   ├── formatters/markdown.ts
│   ├── ratelimit/Limiter.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── _boundary.ts
│   │   ├── meta.ts
│   │   ├── movie.ts
│   │   ├── book.ts
│   │   ├── user.ts
│   │   └── mutation.ts
│   ├── transports/
│   │   ├── stdio.ts
│   │   └── sse.ts
│   ├── utils/logger.ts
│   ├── server.ts
│   ├── cli.ts
│   └── index.ts
├── scripts/
│   └── build-skill-md.ts
├── __tests__/
│   ├── fixtures/...
│   ├── helpers/...
│   ├── unit/...
│   ├── integration/tools/{meta,movie,book,user,mutation}.test.ts
│   └── e2e/{stdio,cli}.test.ts
├── .env.example
├── .gitignore
├── jest.config.js
├── tsconfig.json
├── package.json
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

### 12.2 文档清单（v1.0 必出）

| 文件 | 内容大纲 | 长度 |
|---|---|---|
| `README.md` | badge → 简介 → 特性 → 快速开始（npx）→ Claude Desktop / Cursor 配置示例 → CLI 用法 → 工具表格 → 进阶配置 → FAQ 链接 → 免责声明 | ~300 行 |
| `docs/cookie-guide.md` | 浏览器登录 → F12 → Network → 复制 Cookie 头 → env 配置。带截图 | 50 行 + 3 图 |
| `docs/faq.md` | 7 个常见问题（cookie 过期 / 风控 / 与 xhs-mcp 区别 / SSE 远程 / 找不到资源 / 贡献 / Frodo 切换） | ~150 行 |
| `docs/architecture.md` | 架构图 + 接口契约 + 错误层级 + 缓存/限速 | ~200 行 |
| `docs/superpowers/specs/2026-05-07-douban-mcp-design.md` | 本文档 | ~800 行 |
| `CONTRIBUTING.md` | 开发环境 / 测试 / PR 流程 / fixture 抓取规范 | ~80 行 |
| `CHANGELOG.md` | Keep a Changelog 格式 | 持续 |
| `examples/claude-desktop-config.json` | 直接可拷贝（stdio + SSE 两个版本） | 30 行 |
| `examples/inspector.md` | `npx @modelcontextprotocol/inspector npx -y douban-mcp` | 20 行 |
| `.env.example` | 所有环境变量 + 注释 + 安全提示 | 30 行 |
| `skills/douban/SKILL.md` | frontmatter + 触发场景 + 工作流 + 错误处理 + 前置条件 | ~150 行 |

### 12.3 README.md 风格细节（对标 xhs-mcp）

- 顶部 badge：npm version / license / CI / coverage / smithery
- ASCII 标题 + 节制 emoji（📕 / 🎬 各一个）
- "特性"用 ✅（已实现）+ ⏳（路线图）
- 工具清单用表格（字段：工具名 / 参数 / 鉴权 / 说明）
- 安全提示用 quote block：`> ⚠️ 写操作有封号风险，建议小号验证`
- 免责声明放最末

### 12.4 CI / 发布

**`.github/workflows/ci.yml`**（PR 触发）：

```
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm test --coverage   # L0 + L1 + L2，覆盖率 fail under 80%
- pnpm build:skill-md && git diff --exit-code skills/  # 防漂移
- 上传 codecov
```

**`.github/workflows/release.yml`**（push tag `v*`）：

```
- 跑 ci.yml 全套
- pnpm build
- npm publish --provenance
- gh release create with auto-changelog
```

**`.github/workflows/nightly.yml`**（每日 02:00 UTC）：

```
- 跑 e2e 全套
- 跑 1 次真实 HTTP smoke（匿名 search_movie），验证选择器
- 失败 → gh issue create
```

---

## 13. 关键决策记录

| # | 决策 | 备选 | 理由 |
|---|---|---|---|
| D1 | TypeScript 重写，不换 Python | Python（对标 xhs-mcp） | 现有项目是 TS；CLAUDE.md "TS 优先"；契约语言无关，v2.0 可平行 Python |
| D2 | 双数据源（HTML + Frodo）v1.0 都实现 | 仅 HTML，Frodo 留 v1.1 | 用户要求"完善一点"；Frodo 实现量约 600 行可控 |
| D3 | 双模式（默认只读 / cookie+enable_write 解锁写） | 始终带写 / 仅只读 | secure by default；CI 无需测试账号 |
| D4 | 16 个工具（12 读 + 4 写），`mark_*` 合并 status/rating/comment/tags | 拆 mark_wish/rate_movie 等多个 | 减少 LLM 选择负担；对应豆瓣 UI 真实流程 |
| D5 | 工具返回 markdown，不返回 JSON | JSON 字符串 | 学 xhs-mcp，对 LLM 更友好；CLI 模式才有 `--json` |
| D6 | CLI 是面向 agent 的一等公民，不是给人类的配菜 | 仅 MCP server / 仅人类 CLI / TUI 菜单 | 用户明确：给 Claude Code / OpenClaw 等任意 agent 用 |
| D7 | 单一 toolRegistry → MCP / CLI / SKILL.md 三处派生 | 三处独立维护 | 避免 schema 漂移；CI git diff 检查防回退 |
| D8 | 启动期 cookie 失效：warn + 降级匿名 | fail-fast 报错 | cookie 过期是常态，降级更友好 |
| D9 | `DOUBAN_ENABLE_WRITE=true` 但 cookie 缺失：fail-fast 报错 | 静默忽略 | 防止用户误以为写操作生效 |
| D10 | 测试 4 层全做（L0/L1/L2/L3 + nightly smoke） | 仅 L0+L1 | 用户要求"测试覆盖率尽量高" |
| D11 | 覆盖率 v1.0 ≥ 80%，v1.x ≥ 90% | 60% / 70% | 用户要求高 |
| D12 | Skill 包随仓库交付，用户复制到 `~/.claude/skills/` | 独立 marketplace | v1.0 范围内简化分发；marketplace 后续考虑 |

---

## 14. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 豆瓣 HTML 改版 → 解析失败 | 工具大面积报 ParseError | 每页面有 fixture 单测；nightly smoke 真实抓取，failure 自动开 issue |
| Frodo apikey 被封 | FrodoDataSource 全员失效 | 默认走 HTML；apikey 配置化，更换便利；FAQ 写明回退路径 |
| 触发风控 | 用户 IP 被封 | 严格限速 + 退避；写操作单 session 锁；UA + Referer 模拟真实 |
| 写操作误触发（agent 失控） | 用户账号留下乱七八糟标记 | `DOUBAN_ENABLE_WRITE` 显式 opt-in；SKILL.md 教 agent "确认后再调"；MCP `destructiveHint` 让客户端弹确认；`shareToFeed` 默认 false |
| Cookie 泄露 | 用户账号被劫 | 全局 logger 脱敏；错误消息不带 cookie；README 安全告警 |
| 维护负担（一人项目） | v1.x 跟不上豆瓣改动 | 解析层模块化（每页面独立文件）；nightly smoke 早预警；CONTRIBUTING.md 降低贡献门槛 |

---

## 15. 验收标准

v1.0 发布前必须满足：

- [ ] 所有 16 个工具在 Claude Desktop 中可见且可调用
- [ ] CLI 所有子命令 `--help` 输出正确
- [ ] CLI `--json` 输出能被 `jq` 解析
- [ ] CLI exit code 严格按 §8.3 映射
- [ ] 测试覆盖率 ≥ 80%（CI gate）
- [ ] L1 集成测试覆盖每个工具 happy + error path
- [ ] L2 e2e 测试至少 5 个 case（stdio + CLI）
- [ ] nightly smoke 工作流可跑通
- [ ] README / cookie 教程 / FAQ / 架构文档 / CONTRIBUTING / CHANGELOG 全部完成
- [ ] `examples/claude-desktop-config.json` 拷贝即用
- [ ] `skills/douban/SKILL.md` 拷贝到 `~/.claude/skills/` 后 agent 可正确触发
- [ ] `pnpm build:skill-md` 后 git diff 为空
- [ ] `npx -y douban-mcp` 在干净环境一行启动成功
- [ ] `npm publish` 成功，pkg 含 `dist/` + `skills/` + `examples/`

---

*本文档为 brainstorming skill 产出的设计规格，下一步交由 writing-plans skill 转为可执行的实施计划。*
