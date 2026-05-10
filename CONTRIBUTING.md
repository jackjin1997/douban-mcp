# Contributing

## Dev setup

```bash
pnpm install
pnpm dev    # boot stdio server in tsx
pnpm test
```

## TDD discipline

This repo follows TDD for the public API (MCP tools, datasource interface, CLI):
1. Write a failing test
2. Run it; confirm it fails for the expected reason
3. Implement minimal code
4. Run; confirm pass
5. Commit (one logical change per commit)

For HTML parsers: capture a real fixture first (`__tests__/fixtures/...`), then write a test that asserts on its contents, then write the parser.

## HTML fixture rules

- **Always real**: capture from a live douban page in your browser
- **Strip secrets**: scrub session cookies / personal data before committing
- **One fixture per scenario**: don't reuse fixtures across unrelated tests

## Branching / PR

- main is protected; PR required
- CI must be green (lint + typecheck + tests + skill-md drift)
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`)
- One PR per coherent change

## Release

- Bump `version` in `package.json` (semver) — single source of truth; `src/version.ts` reads from it at runtime, so MCP `serverInfo.version` and `cli --version` follow automatically
- Append a section to `CHANGELOG.md` whose heading matches the version exactly (e.g. `## [1.0.0-alpha.0] — YYYY-MM-DD`)
- Tag `vX.Y.Z` on main; pushing the tag triggers `.github/workflows/release.yml`

### npm dist-tag mapping

The release workflow auto-derives the npm dist-tag from the version string:

| Version pattern | Example | Dist-tag | `npm i douban-mcp-cli` resolves to |
|---|---|---|---|
| `X.Y.Z` (stable) | `1.0.0`, `1.2.3` | `latest` | this version |
| `X.Y.Z-alpha.N` | `1.0.0-alpha.0` | `alpha` | last published stable (or nothing if none) |
| `X.Y.Z-beta.N` | `1.1.0-beta.2` | `beta` | last published stable |
| `X.Y.Z-rc.N` | `2.0.0-rc.1` | `rc` | last published stable |

Users opt into a prerelease channel explicitly: `npm i douban-mcp-cli@alpha`.
