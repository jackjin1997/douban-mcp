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

- Bump `version` in package.json (semver)
- Append section to `CHANGELOG.md`
- Tag `vX.Y.Z` on main; release workflow publishes to npm
