---
name: douban
description: 豆瓣电影、图书查询与个人书单/影单管理。当用户提到豆瓣、想看/在看/看过、书单、影单、电影评分、图书评分、Top250、豆列时使用。
---

# 豆瓣 Skill (douban-mcp CLI)

## 触发场景

| 用户说 | 该用 |
|---|---|
| "豆瓣上 XX 评分多少？" | `search-movie` 找 id → `get-movie` 看详情 |
| "我想看的电影里有哪些科幻？" | `user-collections --status wish` |
| "把 XX 标为看过 5 星" | `mark-movie --status collect --rating 5` |
| "Top250 第一页" | `movie-chart --kind top250` |
| "三体的评分多少" | `search-book` → `get-book` |

## 工作流

### 1. 搜索 → 详情

```bash
douban-mcp-cli --json search-movie --q "盗梦空间" --count 1 \
  | jq -r '.[0].id' \
  | xargs -I{} douban-mcp-cli get-movie --id {}
```

### 2. 我的待看清单

```bash
douban-mcp-cli --json user-collections --uid <your-uid> --category movie --status wish
```

如未配 cookie 或无 uid 报 AUTH_FAILED，提示用户：
- 设置 `DOUBAN_COOKIE` 环境变量后 uid 可省略
- 或显式传 `--uid <id>`

### 3. 批量标记（需写权限）

```bash
douban-mcp-cli --json user-collections --category movie --status wish \
  | jq -r '.[] | select(.subject.rating > 8) | .subject.id' \
  | xargs -I{} douban-mcp-cli mark-movie --id {} --status collect --rating 5
```

需 `DOUBAN_COOKIE` + `DOUBAN_ENABLE_WRITE=true`。

## 错误处理

| Exit | 含义 | Agent 应该 |
|---|---|---|
| 0 | 成功 | 继续 |
| 1 | AUTH_FAILED / WRITE_DISABLED | 提示用户更新 cookie 或开启 enable_write |
| 2 | NOT_FOUND | 报告 id 不存在 |
| 3 | RATE_LIMITED | 等 60s 重试 |
| 4 | PARSE_FAILED / NETWORK / UNKNOWN | 重试一次；仍失败则报告 |

## 配置前置条件

- 安装：`npm i -g douban-mcp-cli` 或 `npx douban-mcp-cli`
- 写操作：`export DOUBAN_COOKIE=...; export DOUBAN_ENABLE_WRITE=true`

## 可用命令（自动生成，勿手改）

<!-- BEGIN AUTO-COMMANDS -->

| 命令 | 说明 |
|---|---|
| `check` | 验证 DOUBAN_COOKIE 是否仍然有效 |
| `search-movie` | 按关键词搜索豆瓣电影。返回标题/年份/评分/链接的 markdown 列表。 |
| `get-movie` | 获取一部电影的详细信息（导演、演员、评分、简介等）。id 是豆瓣电影 subject id（数字）。 |
| `list-movie-reviews` | 获取一部电影的短评列表（不含长评）。 |
| `movie-chart` | 获取电影榜单。kind: top250 (Top250)、weekly (一周口碑榜)、new (近期上映)。 |
| `search-book` | 按关键词搜索豆瓣图书。 |
| `get-book` | 获取图书详情（作者、出版、ISBN、简介等）。id 是豆瓣图书 subject id（数字）。 |
| `list-book-reviews` | 获取图书的短评列表。 |
| `book-chart` | 获取图书榜单。kind: fiction (小说)、non_fiction (随笔)、new (新书速递)。 |
| `user-collections` | 获取某用户的"想看/在看/看过"列表。无 cookie 时必须传 uid。 |
| `user-doulist` | 获取某用户的豆列清单。无 cookie 时必须传 uid。 |
| `user-profile` | 获取某用户的基本信息。无 cookie 时必须传 uid。 |
| `mark-movie` | 标记一部电影（想看/在看/看过），可选打分、备注、标签。需要 cookie + DOUBAN_ENABLE_WRITE。shareToFeed 默认 false（不广播）。 |
| `unmark-movie` | 取消对一部电影的标记。 |
| `mark-book` | 标记一本书（想看/在看/看过），可选打分、备注、标签。需要 cookie + DOUBAN_ENABLE_WRITE。shareToFeed 默认 false（不广播）。 |
| `unmark-book` | 取消对一本书的标记。 |

<!-- END AUTO-COMMANDS -->
