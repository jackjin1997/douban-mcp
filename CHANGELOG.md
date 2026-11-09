# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.1] — 2026-11-09

Makes `mark_movie` / `mark_book` work for the first time (they returned HTTP 404 in every earlier release) and clears all production audit findings.

Known issue: `unmark_movie` / `unmark_book` still fail with `NOT_FOUND`. Douban answers 404 on `/j/subject/<id>/remove`, and the correct endpoint has not been identified yet.

### Changed
- Tool input schemas no longer advertise `additionalProperties: false`. Unknown arguments were always stripped at runtime, so the schema now matches the actual behaviour; integer fields with only a lower bound now carry the JS safe-integer maximum.
- Runtime dependencies: `commander` 14, `dotenv` 18, `pino` 10. Node `>=20` is unchanged (`commander` 15 would require Node 22.12, so it is held back).

### Fixed
- `mark_movie` / `mark_book` always returned `HTTP 404`: the status was appended to the URL path (`/j/subject/<id>/collect`), but Douban's mark endpoint is the fixed `/j/subject/<id>/interest`, with the status already sent in the `interest` form field (#4).
- A write refused with JSON `403 {r:1, code:403}` (not logged in or stale `ck`) was reported as `RATE_LIMITED` and locked writes for the rest of the session. It is now `AUTH_FAILED`, and a refreshed cookie can write again without a restart; bare 401/403 and challenge pages still count as risk control.

### Security
- Upgraded `@modelcontextprotocol/sdk` to `^1.32.2` and `axios` to `^1.21.0`, and refreshed transitive dependencies (express, body-parser, hono, fast-uri, proxy-addr, undici, form-data). `pnpm audit --prod` goes from 127 findings (2 critical, 39 high) to 0.
- Upgraded `zod` to v4 to pick up the fix for unbounded memory use when validating oversized arrays (GHSA-mrhx-c7xc-m3w5).

## [1.0.0] — 2026-11-05

First stable release. Everything below is relative to `1.0.0-alpha.0`.

### Removed
- `FrodoDataSource` (the `frodo.douban.com` App API channel) and the `DOUBAN_EXPERIMENTAL_FRODO` / `DOUBAN_FRODO_APIKEY` variables. Douban requires a request signature for Frodo that was never reverse-engineered, so the channel could not serve a single real request. `DOUBAN_DATA_SOURCE=frodo` still fails fast with `AUTH_FAILED` and a message pointing at `html`; `doctor` reports it under `data_source`.

### Added
- `serve --transport http`: Streamable HTTP transport at `/mcp` (one `McpServer` per `Mcp-Session-Id`, `DELETE` ends the session). The same process keeps serving the legacy `/sse` + `/messages` endpoints for older clients.

### Deprecated
- `serve --transport sse` and the `/sse` endpoint. The flag is now an alias of `--transport http` that logs a warning; the 2024-11-05 HTTP+SSE transport is deprecated upstream.

### Changed
- `serve --transport sse` now binds to `127.0.0.1` by default instead of all interfaces. The SSE endpoint has no authentication and proxies the configured Douban cookie, so exposing it is opt-in via `--host <addr>` or `DOUBAN_HOST`; binding `0.0.0.0` / `::` logs a warning.
- SSE mode rejects requests whose `Host` / `Origin` header is not the loopback endpoint when bound to a loopback address (DNS rebinding protection). The SDK only checks this on `POST /messages`; the `GET /sse` handshake is now checked too.

### Fixed
- A second concurrent SSE client used to get HTTP 500: all streams shared one `McpServer`, and the SDK refuses a second `connect()`. Every HTTP session (Streamable or legacy) now gets its own server instance over the shared data source / cache / rate limiter.
- `movie-chart` parsers (`top250` / `weekly` / `new`) returned `[]` with exit 0 when the page structure drifted. They now throw `PARSE_FAILED` like the book parsers; `top250` still returns `[]` for a page past the end of the list (`start ≥ 250`). Nightly smoke now also probes `movie-chart --kind new`.
- `user-profile` / `check_cookie` returned the sidebar "uid / join date / IP 属地" block as `signature`; it now reads the real signature line (`#display.signature_display` inside the profile `h1`) and is `undefined` when the user has none.
- `mark_*` / `unmark_*` reported success for any HTTP status below 400. Douban answers risk control and expired cookies with 200 + HTML or a redirect, so those writes were silently lost. The data source now requires the JSON `{r: 0}` acknowledgement: challenge pages / `sec.douban.com` → `RATE_LIMITED` with the session write lock, login redirects or `need_login` → `AUTH_FAILED`, HTTP 404 `{r:1, code:404}` → `NOT_FOUND`, other `{r:1, err}` → new `WRITE_REJECTED` (exit code 4) carrying Douban's message.
- `book-chart` silently returned `[]` for every kind: the tag pages (`fiction` / `non_fiction`) are server-rendered `li.subject-item` lists, not the `window.__DATA__` search payload the old code parsed. Added `parseBookTagList`; `new` now reads 新书速递 (`/latest`) via `parseBookLatest`. Both throw `PARSE_FAILED` instead of returning an empty list when the page structure drifts.
- Nightly smoke now probes one page per anonymous list tool and rejects `{"error":…}` payloads (the old `jq length` check accepted them).

## [1.0.0-alpha.0] — 2026-05-09

> 📦 npm 包名为 `douban-mcp-cli`（裸名 `douban-mcp` 在 npm 已被他人占用）；GitHub 仓库 / 产品名仍为 `douban-mcp`。安装命令：`npm i douban-mcp-cli` 或 `npx -y douban-mcp-cli ...`。

### Added
- Real MCP server (stdio + SSE) with 16 tools (12 read + 4 write)
- Agent-native CLI with `--json` mode and standard exit codes
- HtmlDataSource (axios + cheerio) and FrodoDataSource (frodo.douban.com api/v2)
- Read-only / write-enabled dual mode via `DOUBAN_ENABLE_WRITE`
- Cache (node-cache) + rate limit (bottleneck) + risk-control cooldown
- Claude Code skill package (`skills/douban/SKILL.md`) with auto-generated command catalog
- Comprehensive documentation (README, cookie guide, FAQ, architecture, spec, plan)
### Removed
- Legacy Express REST API and mock data scaffolding from pre-1.0
