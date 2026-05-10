# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
