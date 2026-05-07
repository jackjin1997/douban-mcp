# douban-mcp 🎬 📕

[![npm](https://img.shields.io/npm/v/douban-mcp.svg)](https://www.npmjs.com/package/douban-mcp)
[![CI](https://github.com/jackjin1997/douban-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jackjin1997/douban-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**面向 agent 的豆瓣 MCP 服务 + CLI**。同一个包既能做 Claude Desktop 的 MCP server（stdio/SSE），又能给 Claude Code/OpenClaw 等 agent 直接当 CLI 用。

## ✨ 特性

- ✅ 12 个只读工具（电影 / 图书 / 用户态 全覆盖）
- ✅ 4 个写工具（标记想看/在看/看过 + 打分 + 评论 + 标签），双模式 opt-in
- ✅ 双数据源（HTML 默认 / Frodo API 可选），随时切换
- ✅ MCP server (stdio + SSE) + agent native CLI（`--json` 模式）
- ✅ Claude Code Skill 包随仓库交付
- ✅ 内置缓存 + 限速 + 风控退避
- ⏳ v1.1：覆盖率 90%+；user search、doulist items
- ⏳ v1.2：短评写操作

## 🚀 快速开始

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "douban": {
      "command": "npx",
      "args": ["-y", "douban-mcp", "serve"],
      "env": { "DOUBAN_COOKIE": "你的cookie（可选）" }
    }
  }
}
```

### CLI（任何 agent / 命令行）

```bash
npx -y douban-mcp search-movie --q "盗梦空间" --count 3
npx -y douban-mcp get-movie --id 3541415
npx -y douban-mcp --json movie-chart --kind top250 --count 5 | jq
```

启用写操作：

```bash
export DOUBAN_COOKIE="bid=...; dbcl2=\"...\"; ck=...; ll=\"108288\""
export DOUBAN_ENABLE_WRITE=true
npx -y douban-mcp mark-movie --id 3541415 --status collect --rating 5
```

> ⚠️ 写操作有触发风控/封号风险。建议先用小号验证；本项目对账号安全不承担责任。

## 🛠️ 工具清单

### 只读（默认全部可用）

| 工具 | 鉴权 | 说明 |
|---|---|---|
| `search_movie` | 无 | 关键词搜索电影 |
| `get_movie` | 无 | 电影详情 |
| `get_movie_reviews` | 无 | 短评列表 |
| `get_movie_chart` | 无 | 榜单 (top250 / weekly / new) |
| `search_book` | 无 | 关键词搜索图书 |
| `get_book` | 无 | 图书详情 |
| `get_book_reviews` | 无 | 短评列表 |
| `get_book_chart` | 无 | 榜单 (fiction / non_fiction / new) |
| `get_user_collections` | uid 缺省时需 cookie | 想看/在看/看过列表 |
| `get_user_doulist` | uid 缺省时需 cookie | 豆列 |
| `get_user_profile` | uid 缺省时需 cookie | 用户信息 |

### 鉴权 / 写

| 工具 | 鉴权 | 说明 |
|---|---|---|
| `check_cookie` | cookie | cookie 是否有效 |
| `mark_movie` / `unmark_movie` | cookie + DOUBAN_ENABLE_WRITE | 标记/取消标记电影 |
| `mark_book` / `unmark_book` | cookie + DOUBAN_ENABLE_WRITE | 标记/取消标记图书 |

## 📚 文档

- [Cookie 获取](docs/cookie-guide.md)
- [常见问题](docs/faq.md)
- [架构](docs/architecture.md)
- [设计 spec](docs/superpowers/specs/2026-05-07-douban-mcp-design.md)
- [实施计划](docs/superpowers/plans/2026-05-07-douban-mcp-v1.md)
- [贡献指南](CONTRIBUTING.md)
- [变更日志](CHANGELOG.md)
- [已知问题](docs/jack_todo.md)

## ⚙️ 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DOUBAN_COOKIE` | — | 登录态 cookie |
| `DOUBAN_ENABLE_WRITE` | `false` | 启用写操作 |
| `DOUBAN_DATA_SOURCE` | `html` | `html` / `frodo` |
| `DOUBAN_FRODO_APIKEY` | 内置默认 | 覆盖 frodo apikey |
| `DOUBAN_LOG_LEVEL` | `info` | debug/info/warn/error |
| `DOUBAN_DISABLE_CACHE` | `false` | 关闭缓存（测试用） |
| `DOUBAN_USER_AGENT` | 内置 Chrome UA | 覆盖默认 UA |

## 🔧 SSE 模式

```bash
npx -y douban-mcp serve --transport sse --port 3000
# 然后在 MCP 客户端连接 http://localhost:3000/sse
```

## 🧰 调试

```bash
# 用 mcp-inspector 一键调试
npx @modelcontextprotocol/inspector npx -y douban-mcp serve

# 直接命令行调用任何工具（agent 也用这种方式）
npx -y douban-mcp list-tools
npx -y douban-mcp describe search-movie
npx -y douban-mcp doctor
```

## 🛡️ 免责声明

本项目仅供学习和个人使用，禁止用于商业目的或大规模数据爬取。使用本项目造成的任何账号风险（限流、封禁等）由使用者自行承担。本项目无任何官方背景。
