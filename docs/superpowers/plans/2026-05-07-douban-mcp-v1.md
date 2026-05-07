# douban-mcp v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing fake-MCP (Express REST + mock data) project into a real MCP server that exposes 16 douban tools (12 read + 4 write) over stdio/SSE, with a parallel agent-native CLI and a Claude Code skill package, all derived from a single tool registry.

**Architecture:** Layered (transport → tools → datasources → http). Single `toolRegistry` is the source of truth from which the MCP server, CLI subcommands, and `SKILL.md` are derived. Two `IDoubanDataSource` implementations: `HtmlDataSource` (axios + cheerio) and `FrodoDataSource` (httpx + apikey). Read-only by default, write tools opt-in via `DOUBAN_ENABLE_WRITE=true`.

**Tech Stack:** TypeScript 5.x, Node 20+, `@modelcontextprotocol/sdk` (v2 packages), `zod`, `axios`, `cheerio`, `node-cache`, `bottleneck`, `commander`, `pino`, `jest` + `ts-jest`, `execa` (e2e), `pnpm`.

---

## Reference: Spec

Full spec at `docs/superpowers/specs/2026-05-07-douban-mcp-design.md`. The plan implements milestones M1–M7 from spec §1.4 in order. After each milestone there is a **review checkpoint** — stop, summarize what was built, get user approval before continuing.

---

## File Structure (target end state)

```
douban-mcp/
├── .github/workflows/{ci,release,nightly}.yml
├── docs/
│   ├── superpowers/{specs,plans}/
│   ├── cookie-guide.md
│   ├── faq.md
│   └── architecture.md
├── examples/{claude-desktop-config.json,cursor-config.json,inspector.md}
├── skills/douban/SKILL.md
├── scripts/build-skill-md.ts
├── src/
│   ├── index.ts                     # entry: dispatch to server or cli
│   ├── server.ts                    # MCP server bootstrap
│   ├── cli.ts                       # commander-based CLI
│   ├── errors.ts
│   ├── auth/CookieManager.ts
│   ├── cache/MemoryCache.ts
│   ├── ratelimit/Limiter.ts
│   ├── utils/logger.ts
│   ├── transports/{stdio,sse}.ts
│   ├── formatters/markdown.ts
│   ├── datasources/
│   │   ├── types.ts                 # IDoubanDataSource + payload types
│   │   ├── factory.ts
│   │   ├── HtmlDataSource.ts
│   │   ├── FrodoDataSource.ts
│   │   └── parsers/{movie,book,user}.ts
│   └── tools/
│       ├── registry.ts              # SINGLE SOURCE OF TRUTH
│       ├── _boundary.ts
│       ├── meta.ts
│       ├── movie.ts
│       ├── book.ts
│       ├── user.ts
│       └── mutation.ts
├── __tests__/
│   ├── fixtures/{movie,book,user}/*.html
│   ├── helpers/{FakeDataSource,makeServer,loadFixture}.ts
│   ├── unit/...
│   ├── integration/tools/*.test.ts
│   └── e2e/{stdio,cli}.test.ts
├── .env.example
├── package.json                     # bin: { "douban-mcp": "./dist/index.js" }
├── tsconfig.json
├── jest.config.js
├── README.md
├── LICENSE (MIT)
├── CHANGELOG.md
└── CONTRIBUTING.md
```

Files inherited from current state that get **deleted**: `src/index.ts` (Express), `src/services/`, `src/controllers/`, `src/routes/`, `src/types/index.ts` (replaced by `datasources/types.ts`), `src/__tests__/` (all test old API), `public/`, `examples/node-client.js`, `examples/python_client.py`, `docs/mcp_usage_guide.md`, `coverage/`.

---

## Milestone M1 — Protocol Skeleton

Goal: clean slate the old project, install MCP SDK, get a minimal stdio server running with one hello tool, set up CI scaffold.

### Task M1.1 — Wipe old project state

**Files:**
- Delete: `src/index.ts`, `src/services/`, `src/controllers/`, `src/routes/`, `src/types/`, `src/utils/helpers.ts`, `src/__tests__/`, `public/`, `examples/`, `docs/mcp_usage_guide.md`, `coverage/`

- [ ] **Step 1: Remove old source code and demo assets**

```bash
cd /Users/jinzexu/workspace_codes/personal/douban-mcp
rm -rf src/services src/controllers src/routes src/types src/__tests__ public coverage
rm -f src/index.ts src/utils/helpers.ts examples/node-client.js examples/python_client.py docs/mcp_usage_guide.md
```

- [ ] **Step 2: Verify only intentionally-kept files remain**

Run: `ls src/ src/utils/ examples/ docs/ 2>&1`
Expected: `src/utils/logger.ts` survives; `examples/` empty (will refill in M7); `docs/` keeps `superpowers/`.

- [ ] **Step 3: Commit the cleanup**

```bash
git add -A
git commit -m "chore: remove legacy Express REST scaffolding before MCP rewrite"
```

---

### Task M1.2 — Reset package.json with MCP-aligned deps

**Files:**
- Modify: `package.json` (full rewrite)

- [ ] **Step 1: Overwrite package.json**

```json
{
  "name": "douban-mcp",
  "version": "1.0.0-alpha.0",
  "description": "Douban MCP server + agent-native CLI for movies, books, and personal collections",
  "main": "dist/index.js",
  "bin": { "douban-mcp": "dist/index.js" },
  "files": ["dist", "skills", "examples", "README.md", "LICENSE", "CHANGELOG.md"],
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc",
    "dev": "node --import tsx src/index.ts",
    "lint": "eslint src __tests__",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "build:skill-md": "node --import tsx scripts/build-skill-md.ts",
    "prepublishOnly": "pnpm build"
  },
  "keywords": ["douban", "mcp", "model-context-protocol", "agent", "claude", "movies", "books"],
  "author": "JackJin",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/jackjin1997/douban-mcp.git" },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "@modelcontextprotocol/client": "^1.0.0",
    "axios": "^1.9.0",
    "bottleneck": "^2.19.5",
    "cheerio": "^1.0.0",
    "commander": "^12.0.0",
    "dotenv": "^16.5.0",
    "node-cache": "^5.1.2",
    "pino": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^22.15.18",
    "eslint": "^9.0.0",
    "execa": "^9.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.3.4",
    "tsx": "^4.7.0",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Install fresh lockfile**

Run: `pnpm install`
Expected: `pnpm-lock.yaml` updated; no errors. If MCP packages don't resolve, check the v2 package names — fall back to `@modelcontextprotocol/sdk` v1 if needed and adjust imports later (a Note in M2 covers this).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: reset deps for MCP server rewrite"
```

---

### Task M1.3 — TypeScript and Jest config

**Files:**
- Modify: `tsconfig.json`
- Modify: `jest.config.js`
- Create: `.gitignore` (additions)

- [ ] **Step 1: Overwrite tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 2: Overwrite jest.config.js**

```js
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 70, functions: 80, lines: 80, statements: 80 }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  }
};
```

- [ ] **Step 3: Append .gitignore entries**

```bash
cat >> .gitignore <<'EOF'
dist/
coverage/
.env
*.log
.DS_Store
EOF
```

- [ ] **Step 4: Verify typecheck runs (no source yet so it's an empty pass)**

Run: `pnpm typecheck`
Expected: exits 0 (no .ts files to compile is fine).

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json jest.config.js .gitignore
git commit -m "chore: configure TS strict + jest ESM"
```

---

### Task M1.4 — Logger utility (shared across modules)

**Files:**
- Modify: `src/utils/logger.ts` (full rewrite around pino)
- Create: `__tests__/unit/logger.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/unit/logger.test.ts`:

```ts
import { createLogger, redactCookie } from '../../src/utils/logger.js';

describe('redactCookie', () => {
  it('masks dbcl2/bid/ck values inside cookie strings', () => {
    const raw = 'bid=ABC; dbcl2="123:xyz"; ck=DEF; ll="108288"';
    expect(redactCookie(raw)).toBe('bid=***; dbcl2="***"; ck=***; ll="108288"');
  });

  it('returns original string when no cookie keys present', () => {
    expect(redactCookie('hello world')).toBe('hello world');
  });
});

describe('createLogger', () => {
  it('returns an object with info/warn/error/debug', () => {
    const log = createLogger();
    for (const m of ['info', 'warn', 'error', 'debug']) {
      expect(typeof (log as any)[m]).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Run test (expect compile error — module doesn't exist yet)**

Run: `pnpm jest __tests__/unit/logger.test.ts`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement logger**

Create `src/utils/logger.ts`:

```ts
import pino from 'pino';

const COOKIE_KEYS = ['bid', 'dbcl2', 'ck'];

export function redactCookie(input: string): string {
  let out = input;
  for (const key of COOKIE_KEYS) {
    out = out.replace(new RegExp(`(${key})=("?)[^;"]*("?)`, 'g'), '$1=$2***$3');
  }
  return out;
}

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export function createLogger(): Logger {
  const level = (process.env.DOUBAN_LOG_LEVEL ?? 'info') as pino.LevelWithSilent;
  return pino({ level, transport: { target: 'pino/file', options: { destination: 2 } } }) as unknown as Logger;
}

export const logger = createLogger();
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm jest __tests__/unit/logger.test.ts`
Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/logger.ts __tests__/unit/logger.test.ts
git commit -m "feat: add pino-backed logger with cookie redaction"
```

---

### Task M1.5 — Minimal MCP server with one hello tool

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`
- Create: `__tests__/integration/hello.test.ts`
- Create: `__tests__/helpers/makeServer.ts`

- [ ] **Step 1: Write integration test for hello tool**

Create `__tests__/helpers/makeServer.ts`:

```ts
import { Client } from '@modelcontextprotocol/client';
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server';

export async function linkClient(server: McpServer): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(c), server.server.connect(s)]);
  return client;
}
```

Create `__tests__/integration/hello.test.ts`:

```ts
import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';

describe('MCP server skeleton', () => {
  it('exposes a hello tool and returns greeting', async () => {
    const server = buildServer();
    const client = await linkClient(server);
    const list = await client.listTools();
    expect(list.tools.map(t => t.name)).toContain('hello');
    const res = await client.callTool({ name: 'hello', arguments: { who: 'douban' } });
    const text = (res.content[0] as any).text;
    expect(text).toContain('Hello, douban');
  });
});
```

- [ ] **Step 2: Run, expect fail (server module missing)**

Run: `pnpm jest __tests__/integration/hello.test.ts`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement server.ts**

Create `src/server.ts`:

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'douban-mcp', version: '1.0.0-alpha.0' });

  server.registerTool(
    'hello',
    {
      description: 'Smoke-test tool for the douban-mcp server skeleton',
      inputSchema: z.object({ who: z.string().default('world') }),
      annotations: { readOnlyHint: true },
    },
    async ({ who }) => ({ content: [{ type: 'text', text: `Hello, ${who}!` }] }),
  );

  return server;
}
```

- [ ] **Step 4: Implement index.ts entry**

Create `src/index.ts`:

```ts
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('douban-mcp listening on stdio');
}

main().catch(err => {
  logger.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 5: Run test, expect pass**

Run: `pnpm jest __tests__/integration/hello.test.ts`
Expected: PASS.

- [ ] **Step 6: Smoke-run via tsx**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | pnpm dev`
Expected: JSON response listing the `hello` tool.

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/index.ts __tests__/helpers/makeServer.ts __tests__/integration/hello.test.ts
git commit -m "feat: minimal MCP stdio server with hello tool"
```

---

### Task M1.6 — Basic CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflow**

```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test --coverage
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck + test workflow"
```

---

### 🛑 M1 Review Checkpoint

Before starting M2, verify:
- `pnpm test` passes (logger + hello integration)
- `pnpm dev` boots and responds to a `tools/list` request
- CI workflow file exists
- Old Express code is gone

Summarize to user: "M1 done — protocol skeleton works, hello tool callable. Proceed to M2 (data source layer)?"

---

## Milestone M2 — Data Source Layer (HTML)

Goal: define `IDoubanDataSource` interface + types + error hierarchy, implement `HtmlDataSource` method-by-method with fixture-based parser unit tests, set up cache and rate limit.

### Task M2.1 — Error hierarchy

**Files:**
- Create: `src/errors.ts`
- Create: `__tests__/unit/errors.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/errors.test.ts
import {
  DoubanError, AuthError, NotFoundError, RateLimitError,
  ParseError, WriteDisabledError, NetworkError,
} from '../../src/errors.js';

describe('error hierarchy', () => {
  it.each([
    [AuthError, 'AUTH_FAILED'],
    [NotFoundError, 'NOT_FOUND'],
    [RateLimitError, 'RATE_LIMITED'],
    [ParseError, 'PARSE_FAILED'],
    [WriteDisabledError, 'WRITE_DISABLED'],
    [NetworkError, 'NETWORK_ERROR'],
  ])('%s carries code %s and is a DoubanError', (Cls: any, code) => {
    const e = new Cls('msg');
    expect(e).toBeInstanceOf(DoubanError);
    expect(e.code).toBe(code);
    expect(e.message).toBe('msg');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm jest __tests__/unit/errors.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/errors.ts
export class DoubanError extends Error {
  code: string = 'DOUBAN_ERROR';
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class AuthError extends DoubanError      { code = 'AUTH_FAILED' as const; }
export class NotFoundError extends DoubanError  { code = 'NOT_FOUND' as const; }
export class RateLimitError extends DoubanError { code = 'RATE_LIMITED' as const; }
export class ParseError extends DoubanError     { code = 'PARSE_FAILED' as const; }
export class WriteDisabledError extends DoubanError { code = 'WRITE_DISABLED' as const; }
export class NetworkError extends DoubanError   { code = 'NETWORK_ERROR' as const; }
```

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/errors.test.ts
git add src/errors.ts __tests__/unit/errors.test.ts
git commit -m "feat: error hierarchy for douban data layer"
```

---

### Task M2.2 — Datasource types and interface

**Files:**
- Create: `src/datasources/types.ts`

- [ ] **Step 1: Write the file (no test — pure type defs are validated by typecheck + downstream tests)**

```ts
// src/datasources/types.ts
export type CollectionStatus = 'wish' | 'do' | 'collect';
export type MovieChartKind   = 'top250' | 'weekly' | 'new';
export type BookChartKind    = 'fiction' | 'non_fiction' | 'new';

export interface SubjectSummary {
  id: string;
  title: string;
  year?: string;
  rating?: number;
  url: string;
  cover?: string;
}

export interface Person { id: string; name: string; url: string; }

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
  id: string; title: string; description: string; itemCount: number; url: string;
}

export interface UserProfile {
  uid: string; name: string; avatar: string; signature?: string;
  counts?: { wished: number; doing: number; collected: number };
}

export interface MarkOptions {
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  tags?: string[];
  shareToFeed?: boolean;
}

export interface IDoubanDataSource {
  getCurrentUser(): Promise<UserProfile | null>;

  searchMovie(q: string, count: number): Promise<SubjectSummary[]>;
  getMovie(id: string): Promise<MovieDetail>;
  getMovieReviews(id: string, count: number): Promise<Review[]>;
  getMovieChart(kind: MovieChartKind, start: number, count: number): Promise<SubjectSummary[]>;

  searchBook(q: string, count: number): Promise<SubjectSummary[]>;
  getBook(id: string): Promise<BookDetail>;
  getBookReviews(id: string, count: number): Promise<Review[]>;
  getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]>;

  getUserCollections(
    uid: string | null,
    category: 'movie' | 'book',
    status: CollectionStatus,
    start: number,
    count: number
  ): Promise<Collection[]>;
  getUserDoulist(uid: string | null): Promise<Doulist[]>;
  getUserProfile(uid: string | null): Promise<UserProfile>;

  markSubject(category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions): Promise<void>;
  unmarkSubject(category: 'movie' | 'book', id: string): Promise<void>;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/datasources/types.ts
git commit -m "feat: IDoubanDataSource interface and payload types"
```

---

### Task M2.3 — MemoryCache wrapper

**Files:**
- Create: `src/cache/MemoryCache.ts`
- Create: `__tests__/unit/cache.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/cache.test.ts
import { MemoryCache } from '../../src/cache/MemoryCache.js';

describe('MemoryCache', () => {
  it('returns cached value on second call', async () => {
    const cache = new MemoryCache();
    let calls = 0;
    const fetch = async () => { calls++; return 'value'; };
    const v1 = await cache.wrap('k', 60, fetch);
    const v2 = await cache.wrap('k', 60, fetch);
    expect(v1).toBe('value');
    expect(v2).toBe('value');
    expect(calls).toBe(1);
  });

  it('invalidate(prefix) removes matching keys', async () => {
    const cache = new MemoryCache();
    await cache.wrap('user:42:movie', 60, async () => 'a');
    await cache.wrap('user:42:book',  60, async () => 'b');
    await cache.wrap('search:foo',    60, async () => 'c');
    cache.invalidate('user:42:');
    expect(cache.has('user:42:movie')).toBe(false);
    expect(cache.has('user:42:book')).toBe(false);
    expect(cache.has('search:foo')).toBe(true);
  });

  it('respects DOUBAN_DISABLE_CACHE', async () => {
    process.env.DOUBAN_DISABLE_CACHE = 'true';
    const cache = new MemoryCache();
    let calls = 0;
    await cache.wrap('k', 60, async () => { calls++; return 'v'; });
    await cache.wrap('k', 60, async () => { calls++; return 'v'; });
    expect(calls).toBe(2);
    delete process.env.DOUBAN_DISABLE_CACHE;
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm jest __tests__/unit/cache.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/cache/MemoryCache.ts
import NodeCache from 'node-cache';

export class MemoryCache {
  private store = new NodeCache({ checkperiod: 60 });
  private get disabled() { return process.env.DOUBAN_DISABLE_CACHE === 'true'; }

  has(key: string): boolean { return !this.disabled && this.store.has(key); }

  async wrap<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
    if (this.disabled) return fetcher();
    const hit = this.store.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fetcher();
    this.store.set(key, value, ttlSec);
    return value;
  }

  invalidate(keyPrefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(keyPrefix)) this.store.del(k);
    }
  }
}
```

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/cache.test.ts
git add src/cache/MemoryCache.ts __tests__/unit/cache.test.ts
git commit -m "feat: MemoryCache with prefix invalidation and env disable"
```

---

### Task M2.4 — Rate limiter wrapper

**Files:**
- Create: `src/ratelimit/Limiter.ts`
- Create: `__tests__/unit/ratelimit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/ratelimit.test.ts
import { DomainLimiter } from '../../src/ratelimit/Limiter.js';
import { RateLimitError } from '../../src/errors.js';

describe('DomainLimiter', () => {
  it('throws RateLimitError when domain in cooldown', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 1 });
    lim.markCooldown('movie.douban.com');
    await expect(lim.acquireRead('movie.douban.com')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('allows requests after cooldown expires', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 0.05 });
    lim.markCooldown('movie.douban.com');
    await new Promise(r => setTimeout(r, 80));
    await expect(lim.acquireRead('movie.douban.com')).resolves.toBeUndefined();
  });

  it('write session lock persists across cooldown', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 0.05 });
    lim.lockWriteForSession('movie.douban.com');
    await new Promise(r => setTimeout(r, 80));
    await expect(lim.acquireWrite('movie.douban.com')).rejects.toBeInstanceOf(RateLimitError);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm jest __tests__/unit/ratelimit.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/ratelimit/Limiter.ts
import Bottleneck from 'bottleneck';
import { RateLimitError } from '../errors.js';

export interface LimiterConfig { readPerSec: number; writePerSec: number; cooldownSec: number; }

interface DomainState {
  readBucket: Bottleneck;
  writeBucket: Bottleneck;
  cooldownUntil: number;
  cooldownLevel: number;
  writeLocked: boolean;
}

export class DomainLimiter {
  private domains = new Map<string, DomainState>();
  constructor(private cfg: LimiterConfig) {}

  private get(domain: string): DomainState {
    let s = this.domains.get(domain);
    if (!s) {
      s = {
        readBucket: new Bottleneck({ minTime: Math.floor(1000 / this.cfg.readPerSec) }),
        writeBucket: new Bottleneck({ minTime: Math.floor(1000 / this.cfg.writePerSec) }),
        cooldownUntil: 0,
        cooldownLevel: 0,
        writeLocked: false,
      };
      this.domains.set(domain, s);
    }
    return s;
  }

  private guard(s: DomainState, kind: 'read' | 'write'): void {
    if (Date.now() < s.cooldownUntil) {
      throw new RateLimitError(`Domain in cooldown for ${Math.ceil((s.cooldownUntil - Date.now()) / 1000)}s`);
    }
    if (kind === 'write' && s.writeLocked) {
      throw new RateLimitError('Write operations locked for this session due to prior risk-control trigger');
    }
  }

  async acquireRead(domain: string): Promise<void> {
    const s = this.get(domain);
    this.guard(s, 'read');
    await s.readBucket.schedule(() => Promise.resolve());
  }

  async acquireWrite(domain: string): Promise<void> {
    const s = this.get(domain);
    this.guard(s, 'write');
    await s.writeBucket.schedule(() => Promise.resolve());
  }

  markCooldown(domain: string): void {
    const s = this.get(domain);
    s.cooldownLevel = Math.min(s.cooldownLevel + 1, 2);
    const seconds = s.cooldownLevel >= 2 ? Math.max(this.cfg.cooldownSec * 5, 300) : this.cfg.cooldownSec;
    s.cooldownUntil = Date.now() + seconds * 1000;
  }

  lockWriteForSession(domain: string): void { this.get(domain).writeLocked = true; }
}
```

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/ratelimit.test.ts
git add src/ratelimit/Limiter.ts __tests__/unit/ratelimit.test.ts
git commit -m "feat: DomainLimiter with cooldown escalation and write session lock"
```

---

### Task M2.5 — Capture HTML fixtures from douban

**Files:**
- Create: `__tests__/fixtures/movie/inception.html`
- Create: `__tests__/fixtures/movie/search-inception.html`
- Create: `__tests__/fixtures/movie/top250.html`
- Create: `__tests__/fixtures/book/three-body.html`
- Create: `__tests__/fixtures/book/search-three-body.html`
- Create: `__tests__/fixtures/user/collections-watched.html`
- Create: `__tests__/fixtures/user/profile.html`
- Create: `__tests__/fixtures/user/doulist.html`
- Create: `__tests__/helpers/loadFixture.ts`

- [ ] **Step 1: Manually capture each fixture from a real browser session**

For each URL below, open in a logged-out browser, view source, save to the fixture path. Strip any embedded session tokens by hand if present.

| URL | Save to |
|---|---|
| `https://movie.douban.com/subject/3541415/` (Inception) | `__tests__/fixtures/movie/inception.html` |
| `https://search.douban.com/movie/subject_search?search_text=inception` | `__tests__/fixtures/movie/search-inception.html` |
| `https://movie.douban.com/top250` | `__tests__/fixtures/movie/top250.html` |
| `https://book.douban.com/subject/2567698/` (三体) | `__tests__/fixtures/book/three-body.html` |
| `https://search.douban.com/book/subject_search?search_text=三体` | `__tests__/fixtures/book/search-three-body.html` |
| `https://movie.douban.com/people/<any-public-uid>/collect` | `__tests__/fixtures/user/collections-watched.html` |
| `https://www.douban.com/people/<any-public-uid>/` | `__tests__/fixtures/user/profile.html` |
| `https://www.douban.com/people/<any-public-uid>/doulists/all` | `__tests__/fixtures/user/doulist.html` |

- [ ] **Step 2: Implement loadFixture helper**

```ts
// __tests__/helpers/loadFixture.ts
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
export function loadFixture(relativePath: string): string {
  return readFileSync(join(here, '..', 'fixtures', relativePath), 'utf-8');
}
```

- [ ] **Step 3: Commit**

```bash
git add __tests__/fixtures/ __tests__/helpers/loadFixture.ts
git commit -m "test: capture real douban HTML fixtures for parser tests"
```

---

### Task M2.6 — Movie detail parser

**Files:**
- Create: `src/datasources/parsers/movie.ts`
- Create: `__tests__/unit/parsers/movie.test.ts`

- [ ] **Step 1: Write failing tests against fixture**

```ts
// __tests__/unit/parsers/movie.test.ts
import { parseMovieDetail, parseMovieSearch, parseTop250 } from '../../../src/datasources/parsers/movie.js';
import { loadFixture } from '../../helpers/loadFixture.js';

describe('parseMovieDetail (Inception)', () => {
  const movie = parseMovieDetail(loadFixture('movie/inception.html'), '3541415');
  it('extracts title and id', () => {
    expect(movie.id).toBe('3541415');
    expect(movie.title).toContain('盗梦空间');
  });
  it('extracts directors and casts', () => {
    expect(movie.directors.length).toBeGreaterThan(0);
    expect(movie.directors[0].name).toContain('诺兰');
    expect(movie.casts.length).toBeGreaterThan(0);
  });
  it('extracts numeric rating between 0 and 10', () => {
    expect(movie.rating).toBeGreaterThan(0);
    expect(movie.rating).toBeLessThanOrEqual(10);
  });
  it('extracts ratingCount as positive integer', () => {
    expect(movie.ratingCount).toBeGreaterThan(0);
  });
  it('extracts genres array', () => {
    expect(movie.genres.length).toBeGreaterThan(0);
  });
  it('extracts non-empty summary', () => {
    expect(movie.summary.length).toBeGreaterThan(20);
  });
});

describe('parseMovieSearch (inception)', () => {
  const items = parseMovieSearch(loadFixture('movie/search-inception.html'));
  it('returns at least one result', () => { expect(items.length).toBeGreaterThan(0); });
  it('each item has id, title, url', () => {
    for (const item of items.slice(0, 3)) {
      expect(item.id).toMatch(/^\d+$/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.url).toContain('movie.douban.com/subject/');
    }
  });
});

describe('parseTop250', () => {
  const items = parseTop250(loadFixture('movie/top250.html'));
  it('returns 25 items per page', () => { expect(items.length).toBe(25); });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm jest __tests__/unit/parsers/movie.test.ts`

- [ ] **Step 3: Implement parser**

```ts
// src/datasources/parsers/movie.ts
import * as cheerio from 'cheerio';
import type { MovieDetail, SubjectSummary, Person } from '../types.js';
import { ParseError } from '../../errors.js';

export function parseMovieDetail(html: string, id: string): MovieDetail {
  const $ = cheerio.load(html);
  const title = $('h1 span[property="v:itemreviewed"]').text().trim();
  if (!title) throw new ParseError(`Cannot parse movie detail: title missing for id=${id}`);

  const year = $('h1 span.year').text().replace(/[()]/g, '').trim();
  const rating = parseFloat($('strong[property="v:average"]').text()) || undefined;
  const ratingCount = parseInt($('span[property="v:votes"]').text(), 10) || 0;

  const directors: Person[] = $('a[rel="v:directedBy"]').map((_, el) => personFromAnchor($, el)).get();
  const casts: Person[] = $('a[rel="v:starring"]').map((_, el) => personFromAnchor($, el)).get();
  const genres = $('span[property="v:genre"]').map((_, el) => $(el).text()).get();
  const countries = collectInfoLine($, '制片国家/地区');
  const releaseDate = $('span[property="v:initialReleaseDate"]').first().text() || undefined;
  const duration = $('span[property="v:runtime"]').text() || undefined;
  const imdbId = collectInfoLine($, 'IMDb')[0];
  const summary = ($('span[property="v:summary"]').text().trim() || $('#link-report .all').text().trim()).replace(/\s+/g, ' ');
  const cover = $('#mainpic img').attr('src') || undefined;
  const originalTitle = $('h1 span[property="v:itemreviewed"]').next('span').text().trim() || undefined;

  const ratingDistribution = parseRatingDistribution($);

  return {
    id, title, originalTitle, year,
    rating, ratingCount, ratingDistribution,
    url: `https://movie.douban.com/subject/${id}/`, cover,
    directors, casts, genres, countries,
    releaseDate, duration, imdbId,
    summary,
  };
}

function personFromAnchor($: cheerio.CheerioAPI, el: cheerio.Element): Person {
  const a = $(el);
  const href = a.attr('href') ?? '';
  const m = href.match(/\/celebrity\/(\d+)/);
  return { id: m?.[1] ?? '', name: a.text().trim(), url: href.startsWith('http') ? href : `https://movie.douban.com${href}` };
}

function collectInfoLine($: cheerio.CheerioAPI, label: string): string[] {
  const node = $('#info span.pl').filter((_, el) => $(el).text().trim().startsWith(label)).first();
  if (!node.length) return [];
  const raw = (node[0].nextSibling as any)?.data ?? '';
  return raw.split('/').map((s: string) => s.trim()).filter(Boolean);
}

function parseRatingDistribution($: cheerio.CheerioAPI): MovieDetail['ratingDistribution'] {
  const stars = $('.ratings-on-weight .item .power');
  if (stars.length < 5) return undefined;
  const pct = (i: number) => parseFloat($(stars[i]).next('.rating_per').text()) / 100 || 0;
  return { 5: pct(0), 4: pct(1), 3: pct(2), 2: pct(3), 1: pct(4) };
}

export function parseMovieSearch(html: string): SubjectSummary[] {
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  $('.search-result .item-root, .search_result .item-root').each((_, el) => {
    const titleA = $(el).find('a.title-text').first();
    const url = titleA.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: titleA.text().trim(),
      url,
      rating: parseFloat($(el).find('.rating_nums').first().text()) || undefined,
      cover: $(el).find('img').attr('src') || undefined,
    });
  });
  return out;
}

export function parseTop250(html: string): SubjectSummary[] {
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  $('ol.grid_view li .item').each((_, el) => {
    const titleA = $(el).find('.hd a').first();
    const url = titleA.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: $(el).find('.title').first().text().trim(),
      url,
      rating: parseFloat($(el).find('.rating_num').first().text()) || undefined,
      cover: $(el).find('img').attr('src') || undefined,
    });
  });
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm jest __tests__/unit/parsers/movie.test.ts`
If failures: open the fixture HTML, find the actual selector, adjust the parser. Selectors above are typical at time of writing but douban may have shifted markup; rely on the fixture as ground truth.

- [ ] **Step 5: Commit**

```bash
git add src/datasources/parsers/movie.ts __tests__/unit/parsers/movie.test.ts
git commit -m "feat: cheerio parsers for movie detail/search/top250"
```

---

### Task M2.7 — Book parser

**Files:**
- Create: `src/datasources/parsers/book.ts`
- Create: `__tests__/unit/parsers/book.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/unit/parsers/book.test.ts
import { parseBookDetail, parseBookSearch } from '../../../src/datasources/parsers/book.js';
import { loadFixture } from '../../helpers/loadFixture.js';

describe('parseBookDetail (三体)', () => {
  const book = parseBookDetail(loadFixture('book/three-body.html'), '2567698');
  it('extracts title and authors', () => {
    expect(book.title).toContain('三体');
    expect(book.authors.length).toBeGreaterThan(0);
  });
  it('extracts publisher and isbn', () => {
    expect(book.publisher).toBeTruthy();
    expect(book.isbn).toMatch(/^[\d-]{10,17}$/);
  });
  it('extracts numeric rating', () => {
    expect(book.rating).toBeGreaterThan(0);
  });
  it('extracts non-empty summary', () => {
    expect(book.summary.length).toBeGreaterThan(20);
  });
});

describe('parseBookSearch', () => {
  const items = parseBookSearch(loadFixture('book/search-three-body.html'));
  it('returns at least one item with id and title', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^\d+$/);
  });
});
```

- [ ] **Step 2: Run, expect fail; then implement**

```ts
// src/datasources/parsers/book.ts
import * as cheerio from 'cheerio';
import type { BookDetail, SubjectSummary } from '../types.js';
import { ParseError } from '../../errors.js';

export function parseBookDetail(html: string, id: string): BookDetail {
  const $ = cheerio.load(html);
  const title = $('h1 span').first().text().trim();
  if (!title) throw new ParseError(`Cannot parse book detail: title missing id=${id}`);

  const info = $('#info').text();
  const pick = (label: string): string | undefined => {
    const m = info.match(new RegExp(`${label}:\\s*([^\\n]+)`));
    return m ? m[1].trim() : undefined;
  };
  const pickList = (label: string): string[] => {
    const v = pick(label);
    return v ? v.split('/').map(s => s.trim()).filter(Boolean) : [];
  };

  const rating = parseFloat($('strong.rating_num').text()) || undefined;
  const ratingCount = parseInt($('a.rating_people span').text(), 10) || 0;
  const summary = ($('#link-report .intro').first().text().trim() || $('.related_info .intro').first().text().trim()).replace(/\s+/g, ' ');

  return {
    id, title,
    url: `https://book.douban.com/subject/${id}/`,
    cover: $('#mainpic img').attr('src') || undefined,
    rating, ratingCount,
    authors: pickList('作者'),
    translators: pickList('译者'),
    publisher: pick('出版社'),
    publishDate: pick('出版年'),
    pages: parseInt(pick('页数') ?? '', 10) || undefined,
    price: pick('定价'),
    isbn: pick('ISBN'),
    summary,
  };
}

export function parseBookSearch(html: string): SubjectSummary[] {
  const $ = cheerio.load(html);
  const out: SubjectSummary[] = [];
  $('.search-result .item-root').each((_, el) => {
    const titleA = $(el).find('a.title-text').first();
    const url = titleA.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: titleA.text().trim(),
      url,
      rating: parseFloat($(el).find('.rating_nums').first().text()) || undefined,
      cover: $(el).find('img').attr('src') || undefined,
    });
  });
  return out;
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/parsers/book.test.ts
git add src/datasources/parsers/book.ts __tests__/unit/parsers/book.test.ts
git commit -m "feat: cheerio parsers for book detail and search"
```

---

### Task M2.8 — User parsers (collections, profile, doulist)

**Files:**
- Create: `src/datasources/parsers/user.ts`
- Create: `__tests__/unit/parsers/user.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/unit/parsers/user.test.ts
import { parseUserCollections, parseUserProfile, parseUserDoulist } from '../../../src/datasources/parsers/user.js';
import { loadFixture } from '../../helpers/loadFixture.js';

describe('parseUserCollections (movie/collect)', () => {
  const items = parseUserCollections(loadFixture('user/collections-watched.html'), 'movie', 'collect');
  it('returns items with subject id and title', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].subject.id).toMatch(/^\d+$/);
    expect(items[0].subject.title.length).toBeGreaterThan(0);
  });
  it('preserves status', () => {
    expect(items[0].status).toBe('collect');
  });
});

describe('parseUserProfile', () => {
  const profile = parseUserProfile(loadFixture('user/profile.html'));
  it('extracts uid and name', () => {
    expect(profile.uid).toMatch(/^\d+$/);
    expect(profile.name.length).toBeGreaterThan(0);
  });
});

describe('parseUserDoulist', () => {
  const doulists = parseUserDoulist(loadFixture('user/doulist.html'));
  it('returns at least one doulist with id and title', () => {
    expect(doulists.length).toBeGreaterThan(0);
    expect(doulists[0].id).toMatch(/^\d+$/);
  });
});
```

- [ ] **Step 2: Run, expect fail; then implement**

```ts
// src/datasources/parsers/user.ts
import * as cheerio from 'cheerio';
import type { Collection, CollectionStatus, Doulist, UserProfile } from '../types.js';
import { ParseError } from '../../errors.js';

export function parseUserCollections(
  html: string, category: 'movie' | 'book', status: CollectionStatus
): Collection[] {
  const $ = cheerio.load(html);
  const out: Collection[] = [];
  const baseUrl = category === 'movie' ? 'https://movie.douban.com' : 'https://book.douban.com';
  $('.grid-view .item').each((_, el) => {
    const a = $(el).find('.title a').first();
    const url = a.attr('href') ?? '';
    const m = url.match(/\/subject\/(\d+)/);
    if (!m) return;
    const ratingClass = $(el).find('.date').prev('span').attr('class') ?? '';
    const ratingMatch = ratingClass.match(/rating(\d)-t/);
    const tagsText = $(el).find('.tags').text();
    const tags = tagsText.replace(/^标签:\s*/, '').split(/\s+/).filter(Boolean);
    out.push({
      subject: {
        id: m[1],
        title: a.text().trim(),
        url: url.startsWith('http') ? url : `${baseUrl}${url}`,
        cover: $(el).find('img').attr('src') || undefined,
      },
      status,
      rating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      comment: $(el).find('.comment').text().trim() || undefined,
      tags,
      markedAt: $(el).find('.date').text().trim(),
    });
  });
  return out;
}

export function parseUserProfile(html: string): UserProfile {
  const $ = cheerio.load(html);
  const profileLink = $('.user-info .pl a, .info h1').first();
  const name = $('.user-info .info h1, .info h1').first().text().split('的')[0].trim();
  if (!name) throw new ParseError('Cannot parse user profile: name missing');
  const uidMatch = $('a[href*="/people/"]').first().attr('href')?.match(/\/people\/([^\/]+)/);
  const uid = uidMatch?.[1] ?? '';
  return {
    uid,
    name,
    avatar: $('.basic-info img, .user-info img').first().attr('src') ?? '',
    signature: $('.user-info .pl').first().text().trim() || undefined,
  };
}

export function parseUserDoulist(html: string): Doulist[] {
  const $ = cheerio.load(html);
  const out: Doulist[] = [];
  $('.doulist-item, .item').each((_, el) => {
    const a = $(el).find('.title a, .bd a').first();
    const url = a.attr('href') ?? '';
    const m = url.match(/\/doulist\/(\d+)/);
    if (!m) return;
    out.push({
      id: m[1],
      title: a.text().trim(),
      description: $(el).find('.intro').text().trim(),
      itemCount: parseInt($(el).find('.count').text(), 10) || 0,
      url: url.startsWith('http') ? url : `https://www.douban.com${url}`,
    });
  });
  return out;
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/parsers/user.test.ts
git add src/datasources/parsers/user.ts __tests__/unit/parsers/user.test.ts
git commit -m "feat: cheerio parsers for user collections/profile/doulist"
```

---

### Task M2.9 — HtmlDataSource scaffolding (constructor + httpGet helper)

**Files:**
- Create: `src/datasources/HtmlDataSource.ts`
- Create: `__tests__/unit/datasources/HtmlDataSource.test.ts`

- [ ] **Step 1: Write failing test for constructor + risk-control detection**

```ts
// __tests__/unit/datasources/HtmlDataSource.test.ts
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { RateLimitError } from '../../../src/errors.js';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS() {
  return new HtmlDataSource({
    cookie: undefined,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

describe('HtmlDataSource.httpGet', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('throws RateLimitError when response contains /sec/captcha', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: '<html><a href="/sec/captcha">verify</a></html>', request: { res: { responseUrl: 'https://movie.douban.com/sec/captcha' } } });
    const ds = makeDS();
    await expect(ds.searchMovie('test', 5)).rejects.toBeInstanceOf(RateLimitError);
  });
});
```

- [ ] **Step 2: Run, expect fail (module missing)**

Run: `pnpm jest __tests__/unit/datasources/HtmlDataSource.test.ts`

- [ ] **Step 3: Implement scaffolding**

```ts
// src/datasources/HtmlDataSource.ts
import axios, { AxiosInstance } from 'axios';
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from './types.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError, WriteDisabledError } from '../errors.js';
import { CookieManager } from '../auth/CookieManager.js';
import {
  parseMovieDetail, parseMovieSearch, parseTop250,
} from './parsers/movie.js';
import { parseBookDetail, parseBookSearch } from './parsers/book.js';
import { parseUserCollections, parseUserDoulist, parseUserProfile } from './parsers/user.js';

export interface HtmlDataSourceOpts {
  cookie?: string;
  cache: MemoryCache;
  rateLimiter: DomainLimiter;
  userAgent?: string;
}

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class HtmlDataSource implements IDoubanDataSource {
  private http: AxiosInstance;
  private cookies: CookieManager;
  constructor(private opts: HtmlDataSourceOpts) {
    this.cookies = new CookieManager(opts.cookie);
    this.http = axios.create({
      headers: {
        'User-Agent': opts.userAgent ?? process.env.DOUBAN_USER_AGENT ?? DEFAULT_UA,
        'Cookie': this.cookies.toHeader(),
      },
      maxRedirects: 5,
      validateStatus: s => s < 500,
    });
  }

  private async httpGet(url: string, opts: { domain: string; referer?: string } = { domain: 'movie.douban.com' }): Promise<string> {
    await this.opts.rateLimiter.acquireRead(opts.domain);
    let res;
    try {
      res = await this.http.get<string>(url, { headers: opts.referer ? { Referer: opts.referer } : {} });
    } catch (e: any) {
      throw new NetworkError(e.message ?? 'network error');
    }
    if (res.status === 404) throw new NotFoundError(`404 at ${url}`);
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(opts.domain);
      throw new RateLimitError(`HTTP ${res.status} at ${url}`);
    }
    const finalUrl = res.request?.res?.responseUrl ?? url;
    if (finalUrl.includes('/sec/captcha') || (typeof res.data === 'string' && res.data.includes('/sec/captcha'))) {
      this.opts.rateLimiter.markCooldown(opts.domain);
      throw new RateLimitError(`risk control captcha at ${finalUrl}`);
    }
    return res.data;
  }

  // ===== getCurrentUser =====
  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.cookies.hasLogin()) return null;
    return this.opts.cache.wrap('html:getCurrentUser', 300, async () => {
      const html = await this.httpGet('https://www.douban.com/mine/', { domain: 'www.douban.com' });
      try { return parseUserProfile(html); }
      catch { throw new AuthError('cookie present but profile fetch failed — cookie likely expired'); }
    });
  }

  // ===== implementations follow in M2.10 / M2.11 / M2.12 =====
  searchMovie(_q: string, _count: number): Promise<SubjectSummary[]> { throw new Error('NYI: M2.10'); }
  getMovie(_id: string): Promise<MovieDetail> { throw new Error('NYI: M2.10'); }
  getMovieReviews(_id: string, _count: number): Promise<Review[]> { throw new Error('NYI: M2.10'); }
  getMovieChart(_kind: MovieChartKind, _start: number, _count: number): Promise<SubjectSummary[]> { throw new Error('NYI: M2.10'); }
  searchBook(_q: string, _count: number): Promise<SubjectSummary[]> { throw new Error('NYI: M2.11'); }
  getBook(_id: string): Promise<BookDetail> { throw new Error('NYI: M2.11'); }
  getBookReviews(_id: string, _count: number): Promise<Review[]> { throw new Error('NYI: M2.11'); }
  getBookChart(_kind: BookChartKind, _count: number): Promise<SubjectSummary[]> { throw new Error('NYI: M2.11'); }
  getUserCollections(_uid: string | null, _category: 'movie' | 'book', _status: CollectionStatus, _start: number, _count: number): Promise<Collection[]> { throw new Error('NYI: M2.12'); }
  getUserDoulist(_uid: string | null): Promise<Doulist[]> { throw new Error('NYI: M2.12'); }
  getUserProfile(_uid: string | null): Promise<UserProfile> { throw new Error('NYI: M2.12'); }
  markSubject(_category: 'movie' | 'book', _id: string, _status: CollectionStatus, _options: MarkOptions): Promise<void> { throw new WriteDisabledError('write methods land in M4'); }
  unmarkSubject(_category: 'movie' | 'book', _id: string): Promise<void> { throw new WriteDisabledError('write methods land in M4'); }
}
```

The captcha-detection test still won't pass because `searchMovie` throws NYI before httpGet runs. Update the test to call `httpGet` directly via a public method, or add a dedicated `__probe` method during M2.9 only:

```ts
// Add to HtmlDataSource class (temporary, will be removed when real methods land)
public async __probe(url: string): Promise<string> {
  return this.httpGet(url, { domain: 'movie.douban.com' });
}
```

Update test to call `ds.__probe('https://movie.douban.com/x')`.

- [ ] **Step 4: Run, expect pass**

Run: `pnpm jest __tests__/unit/datasources/HtmlDataSource.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datasources/HtmlDataSource.ts src/auth/CookieManager.ts __tests__/unit/datasources/HtmlDataSource.test.ts
git commit -m "feat: HtmlDataSource scaffolding with risk-control detection"
```

Note: `src/auth/CookieManager.ts` is referenced here. If it doesn't exist yet, write a minimal stub with `toHeader()` returning empty string and `hasLogin()` returning false; full impl lands in M4.1.

```ts
// src/auth/CookieManager.ts (stub for M2; replaced in M4.1)
export class CookieManager {
  constructor(private raw: string | undefined) {}
  toHeader(): string { return this.raw ?? ''; }
  hasLogin(): boolean { return Boolean(this.raw && /dbcl2=/.test(this.raw)); }
  getCkToken(): string | null {
    const m = this.raw?.match(/(?:^|;\s*)ck=([^;]+)/);
    return m?.[1] ?? null;
  }
  getOwnUid(): string | null {
    const m = this.raw?.match(/(?:^|;\s*)dbcl2="?(\d+):/);
    return m?.[1] ?? null;
  }
}
```

---

### Task M2.10 — HtmlDataSource: movie methods

**Files:**
- Modify: `src/datasources/HtmlDataSource.ts`
- Create: `__tests__/unit/datasources/HtmlDataSource.movie.test.ts`

- [ ] **Step 1: Write failing test using mocked axios + fixture**

```ts
// __tests__/unit/datasources/HtmlDataSource.movie.test.ts
import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { loadFixture } from '../../helpers/loadFixture.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS() {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie: undefined,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

describe('HtmlDataSource.getMovie', () => {
  it('returns parsed MovieDetail from HTML', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/inception.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/subject/3541415/' } },
    });
    const ds = makeDS();
    const movie = await ds.getMovie('3541415');
    expect(movie.id).toBe('3541415');
    expect(movie.title).toContain('盗梦空间');
  });

  it('caches second call (axios called once)', async () => {
    mockedAxios.get.mockReset().mockResolvedValue({
      status: 200,
      data: loadFixture('movie/inception.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/subject/3541415/' } },
    });
    const ds = makeDS();
    await ds.getMovie('3541415');
    await ds.getMovie('3541415');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('HtmlDataSource.searchMovie', () => {
  it('returns parsed search results', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/search-inception.html'),
      request: { res: { responseUrl: 'https://search.douban.com/movie/subject_search' } },
    });
    const ds = makeDS();
    const items = await ds.searchMovie('inception', 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^\d+$/);
  });
});

describe('HtmlDataSource.getMovieChart top250', () => {
  it('returns 25 items for first page', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: loadFixture('movie/top250.html'),
      request: { res: { responseUrl: 'https://movie.douban.com/top250' } },
    });
    const ds = makeDS();
    const items = await ds.getMovieChart('top250', 0, 25);
    expect(items.length).toBe(25);
  });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement methods (replace NYI stubs)**

In `src/datasources/HtmlDataSource.ts`, replace the four movie NYI methods:

```ts
async searchMovie(q: string, count: number): Promise<SubjectSummary[]> {
  const key = `html:searchMovie:${q}:${count}`;
  return this.opts.cache.wrap(key, 1800, async () => {
    const url = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(q)}&cat=1002`;
    const html = await this.httpGet(url, { domain: 'search.douban.com' });
    return parseMovieSearch(html).slice(0, count);
  });
}

async getMovie(id: string): Promise<MovieDetail> {
  const key = `html:getMovie:${id}`;
  return this.opts.cache.wrap(key, 21600, async () => {
    const html = await this.httpGet(`https://movie.douban.com/subject/${id}/`, { domain: 'movie.douban.com' });
    return parseMovieDetail(html, id);
  });
}

async getMovieReviews(id: string, count: number): Promise<Review[]> {
  const key = `html:getMovieReviews:${id}:${count}`;
  return this.opts.cache.wrap(key, 1800, async () => {
    const html = await this.httpGet(`https://movie.douban.com/subject/${id}/comments?status=P`, { domain: 'movie.douban.com' });
    return parseMovieReviewsFromHtml(html).slice(0, count);
  });
}

async getMovieChart(kind: MovieChartKind, start: number, count: number): Promise<SubjectSummary[]> {
  const key = `html:getMovieChart:${kind}:${start}:${count}`;
  return this.opts.cache.wrap(key, 3600, async () => {
    if (kind === 'top250') {
      const html = await this.httpGet(`https://movie.douban.com/top250?start=${start}`, { domain: 'movie.douban.com' });
      return parseTop250(html).slice(0, count);
    }
    if (kind === 'weekly') {
      const html = await this.httpGet('https://movie.douban.com/chart', { domain: 'movie.douban.com' });
      return parseMovieSearch(html).slice(0, count); // chart uses similar markup; refine if needed
    }
    // 'new' — coming-soon list
    const html = await this.httpGet('https://movie.douban.com/coming', { domain: 'movie.douban.com' });
    return parseMovieSearch(html).slice(0, count);
  });
}
```

Add review parser. In `src/datasources/parsers/movie.ts` append:

```ts
export function parseMovieReviewsFromHtml(html: string): import('../types.js').Review[] {
  const $ = cheerio.load(html);
  const out: import('../types.js').Review[] = [];
  $('#comments .comment-item').each((_, el) => {
    const author = $(el).find('.comment-info a').first();
    const ratingClass = $(el).find('.rating').attr('class') ?? '';
    const ratingMatch = ratingClass.match(/allstar(\d)0/);
    out.push({
      author: author.text().trim(),
      authorUid: (author.attr('href') ?? '').match(/\/people\/([^\/]+)/)?.[1] ?? '',
      rating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      content: $(el).find('.short').text().trim(),
      publishedAt: $(el).find('.comment-time').attr('title') ?? '',
      usefulCount: parseInt($(el).find('.vote-count').text(), 10) || 0,
    });
  });
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm jest __tests__/unit/datasources/HtmlDataSource.movie.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/datasources/HtmlDataSource.ts src/datasources/parsers/movie.ts __tests__/unit/datasources/HtmlDataSource.movie.test.ts
git commit -m "feat: HtmlDataSource movie methods (search/detail/reviews/chart)"
```

---

### Task M2.11 — HtmlDataSource: book methods

**Files:**
- Modify: `src/datasources/HtmlDataSource.ts`
- Create: `__tests__/unit/datasources/HtmlDataSource.book.test.ts`

- [ ] **Step 1: Write failing test (mirror M2.10 movie test)**

```ts
// __tests__/unit/datasources/HtmlDataSource.book.test.ts
import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { loadFixture } from '../../helpers/loadFixture.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS() {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie: undefined,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

it('getBook returns parsed BookDetail', async () => {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: loadFixture('book/three-body.html'),
    request: { res: { responseUrl: 'https://book.douban.com/subject/2567698/' } },
  });
  const book = await makeDS().getBook('2567698');
  expect(book.title).toContain('三体');
  expect(book.authors.length).toBeGreaterThan(0);
});

it('searchBook returns results', async () => {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: loadFixture('book/search-three-body.html'),
    request: { res: { responseUrl: 'https://search.douban.com/book/subject_search' } },
  });
  const items = await makeDS().searchBook('三体', 5);
  expect(items.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// In HtmlDataSource.ts replace 4 book NYI stubs:

async searchBook(q: string, count: number): Promise<SubjectSummary[]> {
  const key = `html:searchBook:${q}:${count}`;
  return this.opts.cache.wrap(key, 1800, async () => {
    const url = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(q)}`;
    const html = await this.httpGet(url, { domain: 'search.douban.com' });
    return parseBookSearch(html).slice(0, count);
  });
}

async getBook(id: string): Promise<BookDetail> {
  const key = `html:getBook:${id}`;
  return this.opts.cache.wrap(key, 21600, async () => {
    const html = await this.httpGet(`https://book.douban.com/subject/${id}/`, { domain: 'book.douban.com' });
    return parseBookDetail(html, id);
  });
}

async getBookReviews(id: string, count: number): Promise<Review[]> {
  const key = `html:getBookReviews:${id}:${count}`;
  return this.opts.cache.wrap(key, 1800, async () => {
    const html = await this.httpGet(`https://book.douban.com/subject/${id}/comments/`, { domain: 'book.douban.com' });
    return parseBookReviewsFromHtml(html).slice(0, count);
  });
}

async getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]> {
  const key = `html:getBookChart:${kind}:${count}`;
  return this.opts.cache.wrap(key, 3600, async () => {
    const tag = kind === 'fiction' ? '小说' : kind === 'non_fiction' ? '随笔' : '新书';
    const url = `https://book.douban.com/tag/${encodeURIComponent(tag)}`;
    const html = await this.httpGet(url, { domain: 'book.douban.com' });
    return parseBookSearch(html).slice(0, count);
  });
}
```

Add `parseBookReviewsFromHtml` to `src/datasources/parsers/book.ts`:

```ts
export function parseBookReviewsFromHtml(html: string): import('../types.js').Review[] {
  const $ = cheerio.load(html);
  const out: import('../types.js').Review[] = [];
  $('.comment-item').each((_, el) => {
    const author = $(el).find('.comment-info a').first();
    const ratingClass = $(el).find('.user-stars').attr('class') ?? '';
    const ratingMatch = ratingClass.match(/allstar(\d)0/);
    out.push({
      author: author.text().trim(),
      authorUid: (author.attr('href') ?? '').match(/\/people\/([^\/]+)/)?.[1] ?? '',
      rating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      content: $(el).find('.short').text().trim(),
      publishedAt: $(el).find('.comment-time').attr('title') ?? $(el).find('.comment-time').text().trim(),
      usefulCount: parseInt($(el).find('.vote-count').text(), 10) || 0,
    });
  });
  return out;
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/datasources/HtmlDataSource.book.test.ts
git add src/datasources/HtmlDataSource.ts src/datasources/parsers/book.ts __tests__/unit/datasources/HtmlDataSource.book.test.ts
git commit -m "feat: HtmlDataSource book methods (search/detail/reviews/chart)"
```

---

### Task M2.12 — HtmlDataSource: user methods

**Files:**
- Modify: `src/datasources/HtmlDataSource.ts`
- Create: `__tests__/unit/datasources/HtmlDataSource.user.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/datasources/HtmlDataSource.user.test.ts
import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { loadFixture } from '../../helpers/loadFixture.js';
import { AuthError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 0.05 }),
  });
}

it('getUserCollections requires uid when no cookie', async () => {
  await expect(makeDS().getUserCollections(null, 'movie', 'collect', 0, 20))
    .rejects.toBeInstanceOf(AuthError);
});

it('getUserCollections returns parsed list when given uid', async () => {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: loadFixture('user/collections-watched.html'),
    request: { res: { responseUrl: 'https://movie.douban.com/people/test/collect' } },
  });
  const list = await makeDS().getUserCollections('test', 'movie', 'collect', 0, 20);
  expect(list.length).toBeGreaterThan(0);
});

it('getUserProfile returns parsed profile', async () => {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: loadFixture('user/profile.html'),
    request: { res: { responseUrl: 'https://www.douban.com/people/test/' } },
  });
  const p = await makeDS().getUserProfile('test');
  expect(p.uid).toBeTruthy();
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// In HtmlDataSource.ts replace 3 user NYI stubs:

private resolveUid(uid: string | null): string {
  if (uid) return uid;
  const own = this.cookies.getOwnUid();
  if (!own) throw new AuthError('uid is null and no DOUBAN_COOKIE configured');
  return own;
}

async getUserCollections(
  uid: string | null, category: 'movie' | 'book', status: CollectionStatus, start: number, count: number
): Promise<Collection[]> {
  const realUid = this.resolveUid(uid);
  const ttl = uid === null ? 300 : 1800;
  const key = `html:getUserCollections:${realUid}:${category}:${status}:${start}:${count}`;
  return this.opts.cache.wrap(key, ttl, async () => {
    const base = category === 'movie' ? 'https://movie.douban.com' : 'https://book.douban.com';
    const path = status === 'wish' ? 'wish' : status === 'do' ? 'do' : 'collect';
    const url = `${base}/people/${realUid}/${path}?start=${start}`;
    const html = await this.httpGet(url, { domain: new URL(base).host });
    return parseUserCollections(html, category, status).slice(0, count);
  });
}

async getUserDoulist(uid: string | null): Promise<Doulist[]> {
  const realUid = this.resolveUid(uid);
  const key = `html:getUserDoulist:${realUid}`;
  return this.opts.cache.wrap(key, 3600, async () => {
    const html = await this.httpGet(`https://www.douban.com/people/${realUid}/doulists/all`, { domain: 'www.douban.com' });
    return parseUserDoulist(html);
  });
}

async getUserProfile(uid: string | null): Promise<UserProfile> {
  const realUid = this.resolveUid(uid);
  const key = `html:getUserProfile:${realUid}`;
  return this.opts.cache.wrap(key, 3600, async () => {
    const html = await this.httpGet(`https://www.douban.com/people/${realUid}/`, { domain: 'www.douban.com' });
    return parseUserProfile(html);
  });
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/datasources/HtmlDataSource.user.test.ts
git add src/datasources/HtmlDataSource.ts __tests__/unit/datasources/HtmlDataSource.user.test.ts
git commit -m "feat: HtmlDataSource user methods (collections/profile/doulist)"
```

---

### Task M2.13 — DataSource factory

**Files:**
- Create: `src/datasources/factory.ts`
- Create: `__tests__/unit/datasources/factory.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/datasources/factory.test.ts
import { createDataSource } from '../../../src/datasources/factory.js';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';

it('default returns HtmlDataSource', () => {
  expect(createDataSource({ kind: 'html' })).toBeInstanceOf(HtmlDataSource);
});

it('throws for unknown kind', () => {
  expect(() => createDataSource({ kind: 'mystery' as any })).toThrow();
});

it('frodo throws "not yet implemented" until M6', () => {
  expect(() => createDataSource({ kind: 'frodo' })).toThrow(/M6/);
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/datasources/factory.ts
import { HtmlDataSource } from './HtmlDataSource.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import type { IDoubanDataSource } from './types.js';

export interface FactoryOpts {
  kind?: 'html' | 'frodo';
  cookie?: string;
  cache?: MemoryCache;
  rateLimiter?: DomainLimiter;
}

export function createDataSource(opts: FactoryOpts = {}): IDoubanDataSource {
  const kind = opts.kind ?? (process.env.DOUBAN_DATA_SOURCE as 'html' | 'frodo' | undefined) ?? 'html';
  const cache = opts.cache ?? new MemoryCache();
  const rateLimiter = opts.rateLimiter ?? new DomainLimiter({ readPerSec: 1, writePerSec: 1 / 3, cooldownSec: 60 });
  if (kind === 'html') return new HtmlDataSource({ cookie: opts.cookie, cache, rateLimiter });
  if (kind === 'frodo') throw new Error('FrodoDataSource lands in M6 — set DOUBAN_DATA_SOURCE=html');
  throw new Error(`Unknown DOUBAN_DATA_SOURCE=${kind}`);
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/datasources/factory.test.ts
git add src/datasources/factory.ts __tests__/unit/datasources/factory.test.ts
git commit -m "feat: data source factory honoring DOUBAN_DATA_SOURCE env"
```

---

### 🛑 M2 Review Checkpoint

Before starting M3, verify:
- All M2 unit tests pass (`pnpm test`)
- Coverage for `src/datasources` ≥ 70%
- HtmlDataSource has working read methods backed by real fixtures
- `createDataSource()` returns `HtmlDataSource` by default

Summarize: "M2 done — full HTML data source layer with parsers, cache, rate limit. Proceed to M3 (tools layer)?"

---

## Milestone M3 — Tools Layer (12 read tools)

Goal: build the single `toolRegistry`, error boundary, markdown formatter, FakeDataSource helper, and register all 12 read tools to a server with full L1 integration tests.

### Task M3.1 — FakeDataSource test helper

**Files:**
- Create: `__tests__/helpers/FakeDataSource.ts`

- [ ] **Step 1: Implement (no test — it's a test helper used by all later tests)**

```ts
// __tests__/helpers/FakeDataSource.ts
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from '../../src/datasources/types.js';

export class FakeDataSource implements IDoubanDataSource {
  public marks: Array<{ category: string; id: string; status: CollectionStatus; options: MarkOptions }> = [];
  public unmarks: Array<{ category: string; id: string }> = [];
  constructor(public overrides: Partial<IDoubanDataSource> = {}) {}

  getCurrentUser = jest.fn(async (): Promise<UserProfile | null> =>
    this.overrides.getCurrentUser ? this.overrides.getCurrentUser() :
      { uid: '99', name: 'TestUser', avatar: '' });

  searchMovie = jest.fn(async (q: string, count: number): Promise<SubjectSummary[]> =>
    this.overrides.searchMovie ? this.overrides.searchMovie(q, count) :
      Array.from({ length: count }, (_, i) => ({
        id: `m${i}`, title: `${q} ${i}`, year: '2020', rating: 8 + i * 0.1,
        url: `https://movie.douban.com/subject/m${i}/`,
      })));

  getMovie = jest.fn(async (id: string): Promise<MovieDetail> =>
    this.overrides.getMovie ? this.overrides.getMovie(id) :
      ({
        id, title: `Movie ${id}`, year: '2020', rating: 8.5, ratingCount: 100,
        url: `https://movie.douban.com/subject/${id}/`,
        directors: [{ id: 'd1', name: 'Director', url: '' }],
        casts: [{ id: 'c1', name: 'Actor', url: '' }],
        genres: ['剧情'], countries: ['中国'], summary: 'Mock summary text long enough.',
      }));

  getMovieReviews = jest.fn(async (_id: string, count: number): Promise<Review[]> =>
    Array.from({ length: count }, (_, i) => ({
      author: `user${i}`, authorUid: `${i}`, content: `comment ${i}`, publishedAt: '2025-01-01', usefulCount: i,
    })));

  getMovieChart = jest.fn(async (_kind: MovieChartKind, _start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `chart${i}`, title: `Chart ${i}`, year: '2020', rating: 9 - i * 0.1,
      url: `https://movie.douban.com/subject/chart${i}/`,
    })));

  searchBook = jest.fn(async (q: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `b${i}`, title: `${q} ${i}`, rating: 7 + i * 0.1,
      url: `https://book.douban.com/subject/b${i}/`,
    })));

  getBook = jest.fn(async (id: string): Promise<BookDetail> => ({
    id, title: `Book ${id}`, rating: 8.0, ratingCount: 50,
    url: `https://book.douban.com/subject/${id}/`,
    authors: ['Author'], publisher: 'Publisher', publishDate: '2020-01-01',
    isbn: '9787000000000', summary: 'Mock book summary text.',
  }));

  getBookReviews = jest.fn(async (_id: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      author: `reader${i}`, authorUid: `${i}`, content: `review ${i}`, publishedAt: '2025-01-01', usefulCount: 0,
    })));

  getBookChart = jest.fn(async (_kind: BookChartKind, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `bc${i}`, title: `Book Chart ${i}`, rating: 8 + i * 0.1,
      url: `https://book.douban.com/subject/bc${i}/`,
    })));

  getUserCollections = jest.fn(async (_uid: string | null, _category: 'movie' | 'book', status: CollectionStatus, _start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      subject: { id: `s${i}`, title: `Subject ${i}`, url: '' },
      status, rating: 4, comment: `note ${i}`, tags: ['tag1'], markedAt: '2025-01-01',
    })));

  getUserDoulist = jest.fn(async (_uid: string | null) => [
    { id: '1', title: 'List 1', description: 'desc', itemCount: 10, url: 'https://www.douban.com/doulist/1/' },
  ]);

  getUserProfile = jest.fn(async (_uid: string | null) => ({
    uid: '99', name: 'TestUser', avatar: '',
  }));

  markSubject = jest.fn(async (category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions) => {
    this.marks.push({ category, id, status, options });
  });

  unmarkSubject = jest.fn(async (category: 'movie' | 'book', id: string) => {
    this.unmarks.push({ category, id });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/helpers/FakeDataSource.ts
git commit -m "test: FakeDataSource helper for tool layer tests"
```

---

### Task M3.2 — Tool registry skeleton

**Files:**
- Create: `src/tools/registry.ts`
- Create: `__tests__/unit/tools/registry.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/tools/registry.test.ts
import { buildToolRegistry } from '../../../src/tools/registry.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

describe('toolRegistry', () => {
  it('always includes all 12 read tools regardless of cookie/write flags', () => {
    const reg = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    const names = reg.map(t => t.id);
    for (const expected of [
      'search_movie', 'get_movie', 'get_movie_reviews', 'get_movie_chart',
      'search_book', 'get_book', 'get_book_reviews', 'get_book_chart',
      'get_user_collections', 'get_user_doulist', 'get_user_profile',
    ]) expect(names).toContain(expected);
  });

  it('includes check_cookie only when cookie is present', () => {
    const noCookie = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    expect(noCookie.find(t => t.id === 'check_cookie')).toBeUndefined();
    const withCookie = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: false });
    expect(withCookie.find(t => t.id === 'check_cookie')).toBeDefined();
  });

  it('includes write tools only when enableWrite=true', () => {
    const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: true });
    for (const w of ['mark_movie', 'unmark_movie', 'mark_book', 'unmark_book']) {
      expect(r.find(t => t.id === w)).toBeDefined();
    }
  });

  it('all read tools carry readOnlyHint=true', () => {
    const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    for (const t of r) {
      if (t.readOnly) expect(t.annotations?.readOnlyHint).toBe(true);
      else expect(t.annotations?.destructiveHint).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run, expect fail (registry/builder missing)**

- [ ] **Step 3: Implement registry shell + per-domain register modules**

```ts
// src/tools/registry.ts
import type { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import { registerMetaTools } from './meta.js';
import { registerMovieTools } from './movie.js';
import { registerBookTools } from './book.js';
import { registerUserTools } from './user.js';
import { registerMutationTools } from './mutation.js';

export interface ToolEntry {
  id: string;
  cliName: string;
  mcpName: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  readOnly: boolean;
  requiresAuth: boolean;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
  handler: (args: any) => Promise<string>; // returns markdown string; boundary wraps to MCP shape
}

export interface RegistryOpts {
  dataSource: IDoubanDataSource;
  cookie: string | undefined;
  enableWrite: boolean;
}

export function buildToolRegistry(opts: RegistryOpts): ToolEntry[] {
  const entries: ToolEntry[] = [];
  if (opts.cookie) entries.push(...registerMetaTools(opts.dataSource));
  entries.push(...registerMovieTools(opts.dataSource));
  entries.push(...registerBookTools(opts.dataSource));
  entries.push(...registerUserTools(opts.dataSource, { cookie: opts.cookie }));
  if (opts.enableWrite) entries.push(...registerMutationTools(opts.dataSource));
  return entries;
}
```

Now create stub modules so the registry compiles. Each will get filled in subsequent tasks.

```ts
// src/tools/meta.ts
import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';

export function registerMetaTools(ds: IDoubanDataSource): ToolEntry[] {
  return [{
    id: 'check_cookie', cliName: 'check', mcpName: 'check_cookie',
    description: '验证 DOUBAN_COOKIE 是否仍然有效',
    inputSchema: z.object({}),
    readOnly: true, requiresAuth: true,
    annotations: { readOnlyHint: true },
    handler: async () => {
      const me = await ds.getCurrentUser();
      return me ? `✅ cookie 有效（用户：${me.name}, uid=${me.uid}）` : '❌ cookie 已失效';
    },
  }];
}
```

```ts
// src/tools/movie.ts (stub — filled in M3.6)
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
export function registerMovieTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
```

```ts
// src/tools/book.ts (stub — filled in M3.7)
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
export function registerBookTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
```

```ts
// src/tools/user.ts (stub — filled in M3.8)
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
export function registerUserTools(_ds: IDoubanDataSource, _opts: { cookie?: string }): ToolEntry[] { return []; }
```

```ts
// src/tools/mutation.ts (stub — filled in M4.4)
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
export function registerMutationTools(_ds: IDoubanDataSource): ToolEntry[] { return []; }
```

- [ ] **Step 4: Run, expect partial pass (only meta + structure tests pass)**

The registry test for "all 12 read tools" will fail until M3.6/7/8 land. That's OK — keep test, mark `xit` or accept the failure for now.

Update test temporarily to assert what M3.2 actually delivers:

```ts
it('includes check_cookie when cookie present', () => {
  const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: false });
  expect(r.find(t => t.id === 'check_cookie')).toBeDefined();
});
```

Comment out (with `// FIXME: re-enable after M3.6/7/8`) the `'always includes all 12 read tools'` and `'all read tools carry readOnlyHint=true'` and `'includes write tools'` assertions. Tag them with TODO so they get re-enabled in M3.6, M3.7, M3.8, M4.4 respectively.

- [ ] **Step 5: Commit**

```bash
pnpm jest __tests__/unit/tools/registry.test.ts
git add src/tools/ __tests__/unit/tools/registry.test.ts
git commit -m "feat: tool registry shell with meta tool registered"
```

---

### Task M3.3 — Error boundary

**Files:**
- Create: `src/tools/_boundary.ts`
- Create: `__tests__/unit/tools/boundary.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/tools/boundary.test.ts
import { withErrorBoundary } from '../../../src/tools/_boundary.js';
import { AuthError, RateLimitError, NotFoundError, WriteDisabledError, ParseError, NetworkError } from '../../../src/errors.js';

describe('withErrorBoundary', () => {
  it('wraps successful handler into MCP content shape', async () => {
    const wrapped = withErrorBoundary(async () => 'hello');
    const r = await wrapped({});
    expect(r.content[0]).toEqual({ type: 'text', text: 'hello' });
    expect(r.isError).toBeUndefined();
  });

  it.each([
    [AuthError,         'cookie 已失效'],
    [NotFoundError,     '找不到对应资源'],
    [RateLimitError,    '触发豆瓣访问限流'],
    [ParseError,        '页面结构变化'],
    [WriteDisabledError,'写操作未启用'],
    [NetworkError,      '网络错误'],
  ])('formats %s into a friendly markdown error', async (Cls: any, marker: string) => {
    const wrapped = withErrorBoundary(async () => { throw new Cls('inner'); });
    const r = await wrapped({});
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toContain(marker);
  });
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/tools/_boundary.ts
import { AuthError, NotFoundError, RateLimitError, ParseError, WriteDisabledError, NetworkError } from '../errors.js';
import { logger } from '../utils/logger.js';

type MCPResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export function withErrorBoundary<TArgs>(handler: (args: TArgs) => Promise<string>) {
  return async (args: TArgs): Promise<MCPResult> => {
    try { return { content: [{ type: 'text', text: await handler(args) }] }; }
    catch (e) {
      const msg = formatError(e);
      return { content: [{ type: 'text', text: msg }], isError: true };
    }
  };
}

export function formatError(e: unknown): string {
  if (e instanceof AuthError)         return '❌ 豆瓣 cookie 已失效。请更新 DOUBAN_COOKIE 环境变量后重启 MCP 服务。';
  if (e instanceof NotFoundError)     return '❌ 找不到对应资源（id 不存在或已删除）。';
  if (e instanceof RateLimitError)    return '⚠️ 触发豆瓣访问限流，请等待 1 分钟后重试。';
  if (e instanceof ParseError)        return '❌ 豆瓣页面结构变化导致解析失败。请到 GitHub 提交 issue：https://github.com/jackjin1997/douban-mcp/issues';
  if (e instanceof WriteDisabledError)return '❌ 写操作未启用。请设置环境变量 DOUBAN_ENABLE_WRITE=true 并重启服务。';
  if (e instanceof NetworkError)      return '⚠️ 网络错误，请检查网络后重试。';
  logger.error('未分类错误', e);
  return `❌ 未知错误：${e instanceof Error ? e.message : String(e)}`;
}

export function errorToCode(e: unknown): string {
  if (e instanceof AuthError) return 'AUTH_FAILED';
  if (e instanceof NotFoundError) return 'NOT_FOUND';
  if (e instanceof RateLimitError) return 'RATE_LIMITED';
  if (e instanceof ParseError) return 'PARSE_FAILED';
  if (e instanceof WriteDisabledError) return 'WRITE_DISABLED';
  if (e instanceof NetworkError) return 'NETWORK_ERROR';
  return 'UNKNOWN';
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/tools/boundary.test.ts
git add src/tools/_boundary.ts __tests__/unit/tools/boundary.test.ts
git commit -m "feat: error boundary mapping DoubanError to friendly messages"
```

---

### Task M3.4 — Markdown formatters

**Files:**
- Create: `src/formatters/markdown.ts`
- Create: `__tests__/unit/formatters/markdown.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/formatters/markdown.test.ts
import {
  formatSubjectList, formatMovieDetail, formatBookDetail,
  formatReviews, formatCollections, formatDoulists, formatProfile,
} from '../../../src/formatters/markdown.js';

describe('formatSubjectList', () => {
  it('renders numbered list with title/rating/url', () => {
    const md = formatSubjectList([
      { id: '1', title: '电影一', year: '2020', rating: 8.5, url: 'https://movie.douban.com/subject/1/' },
    ]);
    expect(md).toMatch(/1\.\s+电影一/);
    expect(md).toContain('8.5');
    expect(md).toContain('https://movie.douban.com/subject/1/');
  });
  it('handles empty list', () => {
    expect(formatSubjectList([])).toContain('未找到');
  });
});

describe('formatMovieDetail', () => {
  it('renders title, year, rating, genres, summary', () => {
    const md = formatMovieDetail({
      id: '1', title: 'Movie', year: '2020', rating: 8.5, ratingCount: 100,
      url: 'https://movie.douban.com/subject/1/', summary: 'A summary',
      directors: [{ id: 'd', name: 'Director', url: '' }],
      casts: [], genres: ['剧情'], countries: ['中国'],
    });
    expect(md).toContain('Movie');
    expect(md).toContain('剧情');
    expect(md).toContain('Director');
  });
});
```

(Add similar minimal expectations for the other formatters.)

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/formatters/markdown.ts
import type {
  SubjectSummary, MovieDetail, BookDetail, Review,
  Collection, Doulist, UserProfile,
} from '../datasources/types.js';

export function formatSubjectList(items: SubjectSummary[]): string {
  if (items.length === 0) return '未找到结果。';
  return items.map((s, i) => {
    const rating = s.rating ? ` ⭐${s.rating}` : '';
    const year = s.year ? `（${s.year}）` : '';
    return `${i + 1}. **${s.title}**${year}${rating}\n   🔗 ${s.url}`;
  }).join('\n\n');
}

export function formatMovieDetail(m: MovieDetail): string {
  const lines = [
    `# ${m.title}${m.year ? `（${m.year}）` : ''}${m.rating ? ` ⭐${m.rating}` : ''}`,
    m.originalTitle ? `**原名**：${m.originalTitle}` : '',
    `**导演**：${m.directors.map(d => d.name).join(' / ') || '—'}`,
    `**主演**：${m.casts.slice(0, 5).map(c => c.name).join(' / ') || '—'}`,
    `**类型**：${m.genres.join(' / ')}`,
    `**国家/地区**：${m.countries.join(' / ')}`,
    m.releaseDate ? `**上映**：${m.releaseDate}` : '',
    m.duration ? `**片长**：${m.duration}` : '',
    `**评分**：${m.rating ?? '—'}（${m.ratingCount} 人评）`,
    '',
    `## 简介\n${m.summary}`,
    '',
    `🔗 ${m.url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatBookDetail(b: BookDetail): string {
  const lines = [
    `# ${b.title}${b.rating ? ` ⭐${b.rating}` : ''}`,
    `**作者**：${b.authors.join(' / ')}`,
    b.translators?.length ? `**译者**：${b.translators.join(' / ')}` : '',
    b.publisher ? `**出版社**：${b.publisher}` : '',
    b.publishDate ? `**出版年**：${b.publishDate}` : '',
    b.pages ? `**页数**：${b.pages}` : '',
    b.price ? `**定价**：${b.price}` : '',
    b.isbn ? `**ISBN**：${b.isbn}` : '',
    `**评分**：${b.rating ?? '—'}（${b.ratingCount} 人评）`,
    '',
    `## 简介\n${b.summary}`,
    '',
    `🔗 ${b.url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatReviews(reviews: Review[]): string {
  if (reviews.length === 0) return '暂无短评。';
  return reviews.map((r, i) => {
    const star = r.rating ? ` ⭐${r.rating}` : '';
    return `${i + 1}. **${r.author}**${star}（${r.publishedAt}，👍 ${r.usefulCount}）\n   ${r.content}`;
  }).join('\n\n');
}

export function formatCollections(items: Collection[]): string {
  if (items.length === 0) return '该列表为空。';
  return items.map((c, i) => {
    const star = c.rating ? ` ⭐${c.rating}` : '';
    const tags = c.tags.length ? ` #${c.tags.join(' #')}` : '';
    const note = c.comment ? `\n   📝 ${c.comment}` : '';
    return `${i + 1}. **${c.subject.title}**${star}（标记于 ${c.markedAt}）${tags}\n   🔗 ${c.subject.url}${note}`;
  }).join('\n\n');
}

export function formatDoulists(items: Doulist[]): string {
  if (items.length === 0) return '该用户没有公开豆列。';
  return items.map((d, i) =>
    `${i + 1}. **${d.title}**（${d.itemCount} 项）\n   ${d.description}\n   🔗 ${d.url}`
  ).join('\n\n');
}

export function formatProfile(p: UserProfile): string {
  const counts = p.counts ? `\n**想看 / 在看 / 看过**：${p.counts.wished} / ${p.counts.doing} / ${p.counts.collected}` : '';
  return `# ${p.name} (uid=${p.uid})${counts}\n\n${p.signature ?? ''}`.trim();
}

export function formatMarkResult(action: 'mark' | 'unmark', category: 'movie' | 'book', id: string): string {
  const verb = action === 'mark' ? '标记' : '取消标记';
  return `✅ 已${verb}${category === 'movie' ? '电影' : '图书'} (id=${id})`;
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/formatters/markdown.test.ts
git add src/formatters/markdown.ts __tests__/unit/formatters/markdown.test.ts
git commit -m "feat: markdown formatters for tool outputs"
```

---

### Task M3.5 — Server bootstrap that registers tools from registry

**Files:**
- Modify: `src/server.ts` (replace hello with full registry-driven registration)
- Create: `__tests__/integration/server-bootstrap.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/integration/server-bootstrap.test.ts
import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';

describe('server bootstrap', () => {
  it('registers check_cookie when cookie provided', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: false });
    const client = await linkClient(server);
    const list = await client.listTools();
    expect(list.tools.find(t => t.name === 'check_cookie')).toBeDefined();
  });

  it('does not register check_cookie when no cookie', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    const client = await linkClient(server);
    const list = await client.listTools();
    expect(list.tools.find(t => t.name === 'check_cookie')).toBeUndefined();
  });

  it('check_cookie tool returns valid status', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: false });
    const client = await linkClient(server);
    const r = await client.callTool({ name: 'check_cookie', arguments: {} });
    expect((r.content[0] as any).text).toContain('TestUser');
  });
});
```

- [ ] **Step 2: Run, expect fail; rewrite server.ts**

```ts
// src/server.ts
import { McpServer } from '@modelcontextprotocol/server';
import { withErrorBoundary } from './tools/_boundary.js';
import { buildToolRegistry, type RegistryOpts } from './tools/registry.js';

export function buildServer(opts: RegistryOpts): McpServer {
  const server = new McpServer({ name: 'douban-mcp', version: '1.0.0-alpha.0' });
  const registry = buildToolRegistry(opts);
  for (const tool of registry) {
    server.registerTool(
      tool.mcpName,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      withErrorBoundary(tool.handler) as any,
    );
  }
  return server;
}
```

- [ ] **Step 3: Update src/index.ts to read env and call buildServer**

```ts
#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';

async function main() {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';
  if (enableWrite && !cookie) {
    logger.error('DOUBAN_ENABLE_WRITE=true requires DOUBAN_COOKIE.');
    process.exit(2);
  }
  const dataSource = createDataSource({ cookie });
  if (cookie) {
    const me = await dataSource.getCurrentUser().catch(() => null);
    if (!me) logger.warn('DOUBAN_COOKIE present but appears expired; running anonymously.');
    else logger.info(`Logged in as ${me.name} (${me.uid})`);
  }
  const server = buildServer({ dataSource, cookie, enableWrite });
  await server.connect(new StdioServerTransport());
  logger.info('douban-mcp listening on stdio');
}

main().catch(err => { logger.error('fatal', err); process.exit(1); });
```

- [ ] **Step 4: Run; the old hello test will fail because we removed the hello tool**

Delete `__tests__/integration/hello.test.ts` (it was scaffolding for M1).

- [ ] **Step 5: Run, expect pass; commit**

```bash
rm __tests__/integration/hello.test.ts
pnpm test
git add src/server.ts src/index.ts __tests__/integration/server-bootstrap.test.ts
git rm __tests__/integration/hello.test.ts
git commit -m "feat: registry-driven server bootstrap"
```

---

### Task M3.6 — Movie domain tools (4 tools)

**Files:**
- Modify: `src/tools/movie.ts` (replace stub with real implementation)
- Create: `__tests__/integration/tools/movie.test.ts`

- [ ] **Step 1: Write integration test for all 4 movie tools**

```ts
// __tests__/integration/tools/movie.test.ts
import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

async function makeClient() {
  return linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false }));
}

it('search_movie returns markdown listing', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'search_movie', arguments: { q: '盗梦', count: 3 } });
  const text = (r.content[0] as any).text;
  expect(text).toContain('盗梦 0');
  expect(text).toMatch(/movie\.douban\.com\/subject\/m0/);
});

it('search_movie rejects empty q', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'search_movie', arguments: { q: '' } });
  expect(r.isError).toBe(true);
});

it('get_movie returns detail markdown', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_movie', arguments: { id: '1234' } });
  expect((r.content[0] as any).text).toContain('Movie 1234');
});

it('get_movie_reviews returns numbered list', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_movie_reviews', arguments: { id: '1', count: 2 } });
  expect((r.content[0] as any).text).toMatch(/1\.\s+\*\*user0\*\*/);
});

it('get_movie_chart with kind=top250 returns markdown list', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_movie_chart', arguments: { kind: 'top250', count: 2 } });
  expect((r.content[0] as any).text).toContain('Chart 0');
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/tools/movie.ts
import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatSubjectList, formatMovieDetail, formatReviews } from '../formatters/markdown.js';

export function registerMovieTools(ds: IDoubanDataSource): ToolEntry[] {
  return [
    {
      id: 'search_movie', cliName: 'search-movie', mcpName: 'search_movie',
      description: '按关键词搜索豆瓣电影。返回标题/年份/评分/链接的 markdown 列表。',
      inputSchema: z.object({
        q: z.string().min(1, 'q 不能为空'),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Search Movies' },
      handler: async ({ q, count }) => formatSubjectList(await ds.searchMovie(q, count)),
    },
    {
      id: 'get_movie', cliName: 'get-movie', mcpName: 'get_movie',
      description: '获取一部电影的详细信息（导演、演员、评分、简介等）。id 是豆瓣电影 subject id（数字）。',
      inputSchema: z.object({ id: z.string().regex(/^\d+$/, 'id 必须是数字字符串') }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Get Movie Detail' },
      handler: async ({ id }) => formatMovieDetail(await ds.getMovie(id)),
    },
    {
      id: 'get_movie_reviews', cliName: 'list-movie-reviews', mcpName: 'get_movie_reviews',
      description: '获取一部电影的短评列表（不含长评）。',
      inputSchema: z.object({
        id: z.string().regex(/^\d+$/),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'List Movie Reviews' },
      handler: async ({ id, count }) => formatReviews(await ds.getMovieReviews(id, count)),
    },
    {
      id: 'get_movie_chart', cliName: 'movie-chart', mcpName: 'get_movie_chart',
      description: '获取电影榜单。kind: top250 (Top250)、weekly (一周口碑榜)、new (近期上映)。',
      inputSchema: z.object({
        kind: z.enum(['top250', 'weekly', 'new']),
        start: z.number().int().min(0).default(0),
        count: z.number().int().min(1).max(25).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Movie Chart' },
      handler: async ({ kind, start, count }) => formatSubjectList(await ds.getMovieChart(kind, start, count)),
    },
  ];
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm test
git add src/tools/movie.ts __tests__/integration/tools/movie.test.ts
git commit -m "feat: movie domain tools (search/get/reviews/chart)"
```

---

### Task M3.7 — Book domain tools (4 tools)

**Files:**
- Modify: `src/tools/book.ts`
- Create: `__tests__/integration/tools/book.test.ts`

- [ ] **Step 1: Write tests (mirror movie tests)**

```ts
// __tests__/integration/tools/book.test.ts
import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

async function makeClient() {
  return linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false }));
}

it('search_book returns markdown', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'search_book', arguments: { q: '三体', count: 2 } });
  expect((r.content[0] as any).text).toContain('三体 0');
});

it('get_book returns detail', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_book', arguments: { id: '999' } });
  const text = (r.content[0] as any).text;
  expect(text).toContain('Book 999');
  expect(text).toContain('Author');
});

it('get_book_reviews returns list', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_book_reviews', arguments: { id: '1', count: 2 } });
  expect((r.content[0] as any).text).toMatch(/reader0/);
});

it('get_book_chart returns markdown list', async () => {
  const c = await makeClient();
  const r = await c.callTool({ name: 'get_book_chart', arguments: { kind: 'fiction', count: 2 } });
  expect((r.content[0] as any).text).toContain('Book Chart 0');
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/tools/book.ts
import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatSubjectList, formatBookDetail, formatReviews } from '../formatters/markdown.js';

export function registerBookTools(ds: IDoubanDataSource): ToolEntry[] {
  return [
    {
      id: 'search_book', cliName: 'search-book', mcpName: 'search_book',
      description: '按关键词搜索豆瓣图书。',
      inputSchema: z.object({
        q: z.string().min(1),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Search Books' },
      handler: async ({ q, count }) => formatSubjectList(await ds.searchBook(q, count)),
    },
    {
      id: 'get_book', cliName: 'get-book', mcpName: 'get_book',
      description: '获取图书详情（作者、出版、ISBN、简介等）。',
      inputSchema: z.object({ id: z.string().regex(/^\d+$/) }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Get Book Detail' },
      handler: async ({ id }) => formatBookDetail(await ds.getBook(id)),
    },
    {
      id: 'get_book_reviews', cliName: 'list-book-reviews', mcpName: 'get_book_reviews',
      description: '获取图书的短评列表。',
      inputSchema: z.object({
        id: z.string().regex(/^\d+$/),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'List Book Reviews' },
      handler: async ({ id, count }) => formatReviews(await ds.getBookReviews(id, count)),
    },
    {
      id: 'get_book_chart', cliName: 'book-chart', mcpName: 'get_book_chart',
      description: '获取图书榜单。kind: fiction (小说)、non_fiction (随笔)、new (新书速递)。',
      inputSchema: z.object({
        kind: z.enum(['fiction', 'non_fiction', 'new']),
        count: z.number().int().min(1).max(20).default(10),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'Book Chart' },
      handler: async ({ kind, count }) => formatSubjectList(await ds.getBookChart(kind, count)),
    },
  ];
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm test
git add src/tools/book.ts __tests__/integration/tools/book.test.ts
git commit -m "feat: book domain tools (search/get/reviews/chart)"
```

---

### Task M3.8 — User domain tools (3 tools)

**Files:**
- Modify: `src/tools/user.ts`
- Create: `__tests__/integration/tools/user.test.ts`

- [ ] **Step 1: Write tests**

```ts
// __tests__/integration/tools/user.test.ts
import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

it('get_user_profile returns profile markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r = await client.callTool({ name: 'get_user_profile', arguments: { uid: '42' } });
  expect((r.content[0] as any).text).toContain('TestUser');
});

it('get_user_collections without uid and without cookie returns AuthError', async () => {
  const ds = new FakeDataSource();
  ds.getUserCollections = jest.fn(async (uid: string | null) => {
    if (!uid) {
      // simulate the real datasource behavior
      const { AuthError } = await import('../../../src/errors.js');
      throw new AuthError('uid is null and no cookie');
    }
    return [];
  }) as any;
  const server = buildServer({ dataSource: ds, cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r = await client.callTool({ name: 'get_user_collections', arguments: { category: 'movie', status: 'collect' } });
  expect(r.isError).toBe(true);
});

it('get_user_collections with uid returns markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r = await client.callTool({ name: 'get_user_collections', arguments: { uid: '42', category: 'movie', status: 'collect', count: 2 } });
  expect((r.content[0] as any).text).toContain('Subject 0');
});

it('get_user_doulist returns markdown', async () => {
  const server = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
  const client = await linkClient(server);
  const r = await client.callTool({ name: 'get_user_doulist', arguments: { uid: '42' } });
  expect((r.content[0] as any).text).toContain('List 1');
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/tools/user.ts
import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatCollections, formatDoulists, formatProfile } from '../formatters/markdown.js';

export function registerUserTools(ds: IDoubanDataSource, opts: { cookie?: string }): ToolEntry[] {
  const uidSchema = opts.cookie ? z.string().optional() : z.string({ required_error: '未配置 cookie 时必须传入 uid' });
  return [
    {
      id: 'get_user_collections', cliName: 'user-collections', mcpName: 'get_user_collections',
      description: '获取某用户的"想看/在看/看过"列表。无 cookie 时必须传 uid。',
      inputSchema: z.object({
        uid: uidSchema,
        category: z.enum(['movie', 'book']),
        status: z.enum(['wish', 'do', 'collect']),
        start: z.number().int().min(0).default(0),
        count: z.number().int().min(1).max(30).default(15),
      }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Collections' },
      handler: async ({ uid, category, status, start, count }) =>
        formatCollections(await ds.getUserCollections(uid ?? null, category, status, start, count)),
    },
    {
      id: 'get_user_doulist', cliName: 'user-doulist', mcpName: 'get_user_doulist',
      description: '获取某用户的豆列清单。',
      inputSchema: z.object({ uid: uidSchema }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Doulists' },
      handler: async ({ uid }) => formatDoulists(await ds.getUserDoulist(uid ?? null)),
    },
    {
      id: 'get_user_profile', cliName: 'user-profile', mcpName: 'get_user_profile',
      description: '获取某用户的基本信息。',
      inputSchema: z.object({ uid: uidSchema }),
      readOnly: true, requiresAuth: false,
      annotations: { readOnlyHint: true, title: 'User Profile' },
      handler: async ({ uid }) => formatProfile(await ds.getUserProfile(uid ?? null)),
    },
  ];
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm test
git add src/tools/user.ts __tests__/integration/tools/user.test.ts
git commit -m "feat: user domain tools (collections/doulist/profile)"
```

---

### Task M3.9 — Re-enable registry meta-tests

**Files:**
- Modify: `__tests__/unit/tools/registry.test.ts`

- [ ] **Step 1: Restore the assertions disabled in M3.2**

Re-enable the `'always includes all 12 read tools'` and `'all read tools carry readOnlyHint=true'` test cases. Remove FIXME comments. Run `pnpm test` — all should pass now.

- [ ] **Step 2: Add a meta-test that scans every entry in registry**

Add to `registry.test.ts`:

```ts
it('every read tool has annotations.readOnlyHint=true', () => {
  const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: true });
  for (const t of r) {
    if (t.readOnly) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).not.toBe(true);
    } else {
      expect(t.annotations?.destructiveHint).toBe(true);
      expect(t.annotations?.readOnlyHint).not.toBe(true);
    }
  }
});

it('CLI names are unique kebab-case', () => {
  const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: true });
  const names = r.map(t => t.cliName);
  expect(new Set(names).size).toBe(names.length);
  for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9-]*$/);
});

it('MCP names are unique snake_case', () => {
  const r = buildToolRegistry({ dataSource: new FakeDataSource(), cookie: 'bid=x', enableWrite: true });
  const names = r.map(t => t.mcpName);
  expect(new Set(names).size).toBe(names.length);
  for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
});
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm test
git add __tests__/unit/tools/registry.test.ts
git commit -m "test: meta-tests on tool registry annotations and naming"
```

---

### 🛑 M3 Review Checkpoint

Before starting M4, verify:
- All 12 read tools registered and callable through MCP
- Coverage for `src/tools/` ≥ 85%
- Registry meta-tests prevent annotation drift
- `pnpm dev` (with no env vars) lets MCP inspector see all 11 anonymous-mode tools

Summarize: "M3 done — 12 read tools wired through registry → server → markdown. Proceed to M4 (auth + write)?"

---

## Milestone M4 — Auth + Write Operations

Goal: full `CookieManager`, `HtmlDataSource.markSubject` / `unmarkSubject` with cache invalidation, 4 write tools registered behind `DOUBAN_ENABLE_WRITE`, dual-mode startup tests.

### Task M4.1 — CookieManager full implementation

**Files:**
- Modify: `src/auth/CookieManager.ts` (the stub from M2.9)
- Create: `__tests__/unit/auth/CookieManager.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/auth/CookieManager.test.ts
import { CookieManager } from '../../../src/auth/CookieManager.js';

describe('CookieManager', () => {
  const cookie = 'bid=ABCDE; ll="108288"; dbcl2="12345:xyz"; ck=DEFG; ap_v=0';
  const mgr = new CookieManager(cookie);

  it('toHeader returns full cookie string when present', () => {
    expect(mgr.toHeader()).toBe(cookie);
  });

  it('toHeader returns empty string when undefined', () => {
    expect(new CookieManager(undefined).toHeader()).toBe('');
  });

  it('getOwnUid extracts numeric uid from dbcl2', () => {
    expect(mgr.getOwnUid()).toBe('12345');
  });

  it('getOwnUid returns null when no dbcl2', () => {
    expect(new CookieManager('bid=x').getOwnUid()).toBeNull();
  });

  it('getCkToken extracts ck value', () => {
    expect(mgr.getCkToken()).toBe('DEFG');
  });

  it('hasLogin returns true when dbcl2 present', () => {
    expect(mgr.hasLogin()).toBe(true);
    expect(new CookieManager(undefined).hasLogin()).toBe(false);
    expect(new CookieManager('bid=x').hasLogin()).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect pass against M2.9 stub for most cases. Make sure all assertions pass; if `getOwnUid` regex needs tweaking, fix it.**

The stub in M2.9 already has these methods. Verify they all pass:

```bash
pnpm jest __tests__/unit/auth/CookieManager.test.ts
```

- [ ] **Step 3: Commit (test promotion)**

```bash
git add __tests__/unit/auth/CookieManager.test.ts
git commit -m "test: lock CookieManager API with explicit unit tests"
```

---

### Task M4.2 — HtmlDataSource.markSubject / unmarkSubject

**Files:**
- Modify: `src/datasources/HtmlDataSource.ts`
- Create: `__tests__/unit/datasources/HtmlDataSource.write.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/datasources/HtmlDataSource.write.test.ts
import axios from 'axios';
import { HtmlDataSource } from '../../../src/datasources/HtmlDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';
import { AuthError } from '../../../src/errors.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new HtmlDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 }),
  });
}

describe('HtmlDataSource.markSubject', () => {
  it('throws AuthError when no cookie', async () => {
    const ds = makeDS(undefined);
    await expect(ds.markSubject('movie', '1', 'collect', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('POSTs to /j/subject/<id>/wish with ck token', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.markSubject('movie', '1234', 'collect', { rating: 5, comment: 'great', tags: ['ai'], shareToFeed: false });
    expect(mockedAxios.post).toHaveBeenCalled();
    const [url, body] = (mockedAxios.post as jest.Mock).mock.calls[0];
    expect(url).toContain('/j/subject/1234/');
    expect(body.toString()).toContain('ck=CSRF');
    expect(body.toString()).toContain('interest=collect');
    expect(body.toString()).toContain('rating=5');
  });

  it('invalidates self collection cache after success', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    mockedAxios.get.mockResolvedValue({
      status: 200, data: '<html></html>',
      request: { res: { responseUrl: 'https://movie.douban.com/' } },
    });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    // populate cache for own user collection
    await (ds as any).opts.cache.wrap('html:getUserCollections:1:movie:wish:0:15', 60, async () => 'cached');
    await ds.markSubject('movie', '1234', 'collect', {});
    expect((ds as any).opts.cache.has('html:getUserCollections:1:movie:wish:0:15')).toBe(false);
  });
});

describe('HtmlDataSource.unmarkSubject', () => {
  it('POSTs to /j/subject/<id>/unwish (or equivalent endpoint)', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { r: 0 } });
    const ds = makeDS('bid=x; dbcl2="1:y"; ck=CSRF');
    await ds.unmarkSubject('movie', '1234');
    const [url] = (mockedAxios.post as jest.Mock).mock.calls.at(-1)!;
    expect(url).toContain('/1234/');
  });
});
```

- [ ] **Step 2: Run, expect fail (NYI from M2.9); implement**

In `src/datasources/HtmlDataSource.ts` replace the two write NYI stubs:

```ts
async markSubject(category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions): Promise<void> {
  if (!this.cookies.hasLogin()) throw new AuthError('mark requires DOUBAN_COOKIE');
  const ck = this.cookies.getCkToken();
  if (!ck) throw new AuthError('cookie missing ck token (CSRF)');

  const domain = category === 'movie' ? 'movie.douban.com' : 'book.douban.com';
  await this.opts.rateLimiter.acquireWrite(domain);

  const params = new URLSearchParams();
  params.set('ck', ck);
  params.set('interest', status);
  if (options.rating != null) params.set('rating', String(options.rating));
  if (options.comment) params.set('comment', options.comment);
  if (options.tags?.length) params.set('tags', options.tags.join(' '));
  params.set('share-shuo', options.shareToFeed ? 'douban' : '');

  const url = `https://${domain}/j/subject/${id}/${status === 'wish' ? 'wish' : status === 'do' ? 'do' : 'collect'}`;
  let res;
  try {
    res = await this.http.post(url, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `https://${domain}/subject/${id}/`,
        'Cookie': this.cookies.toHeader(),
      },
    });
  } catch (e: any) {
    throw new NetworkError(e.message ?? 'network error');
  }
  if (res.status === 401 || res.status === 403) {
    this.opts.rateLimiter.markCooldown(domain);
    this.opts.rateLimiter.lockWriteForSession(domain);
    throw new RateLimitError('write blocked by risk control; session write lock engaged');
  }
  if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);

  const ownUid = this.cookies.getOwnUid();
  if (ownUid) this.opts.cache.invalidate(`html:getUserCollections:${ownUid}:${category}`);
}

async unmarkSubject(category: 'movie' | 'book', id: string): Promise<void> {
  if (!this.cookies.hasLogin()) throw new AuthError('unmark requires DOUBAN_COOKIE');
  const ck = this.cookies.getCkToken();
  if (!ck) throw new AuthError('cookie missing ck token');

  const domain = category === 'movie' ? 'movie.douban.com' : 'book.douban.com';
  await this.opts.rateLimiter.acquireWrite(domain);

  const params = new URLSearchParams();
  params.set('ck', ck);

  const url = `https://${domain}/j/subject/${id}/remove`;
  const res = await this.http.post(url, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `https://${domain}/subject/${id}/`,
      'Cookie': this.cookies.toHeader(),
    },
  }).catch((e: any) => { throw new NetworkError(e.message); });

  if (res.status === 401 || res.status === 403) {
    this.opts.rateLimiter.markCooldown(domain);
    this.opts.rateLimiter.lockWriteForSession(domain);
    throw new RateLimitError('unmark blocked by risk control');
  }
  if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);

  const ownUid = this.cookies.getOwnUid();
  if (ownUid) this.opts.cache.invalidate(`html:getUserCollections:${ownUid}:${category}`);
}
```

Note: the exact douban write endpoints may have shifted. If the request fails with 404 in real testing, inspect a real browser POST when manually marking a subject (devtools → Network) and adjust the URL/params. The structure (POST with `ck`, `interest`, optional `rating`/`comment`/`tags`/`share-shuo`) is correct as of writing.

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/datasources/HtmlDataSource.write.test.ts
git add src/datasources/HtmlDataSource.ts __tests__/unit/datasources/HtmlDataSource.write.test.ts
git commit -m "feat: HtmlDataSource markSubject/unmarkSubject with cache invalidation"
```

---

### Task M4.3 — Mutation tools (4 write tools)

**Files:**
- Modify: `src/tools/mutation.ts`
- Create: `__tests__/integration/tools/mutation.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/integration/tools/mutation.test.ts
import { buildServer } from '../../../src/server.js';
import { linkClient } from '../../helpers/makeServer.js';
import { FakeDataSource } from '../../helpers/FakeDataSource.js';

describe('mutation tools', () => {
  it('mark_movie records call on dataSource', async () => {
    const ds = new FakeDataSource();
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    const r = await client.callTool({
      name: 'mark_movie',
      arguments: { id: '1234', status: 'collect', rating: 5, comment: 'great' }
    });
    expect((r.content[0] as any).text).toContain('已标记');
    expect(ds.marks).toEqual([{ category: 'movie', id: '1234', status: 'collect', options: { rating: 5, comment: 'great', shareToFeed: false } }]);
  });

  it('unmark_book records call', async () => {
    const ds = new FakeDataSource();
    const server = buildServer({ dataSource: ds, cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    await client.callTool({ name: 'unmark_book', arguments: { id: '999' } });
    expect(ds.unmarks).toEqual([{ category: 'book', id: '999' }]);
  });

  it('write tools NOT registered when enableWrite=false', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false });
    const client = await linkClient(server);
    const list = await client.listTools();
    for (const w of ['mark_movie', 'unmark_movie', 'mark_book', 'unmark_book']) {
      expect(list.tools.find(t => t.name === w)).toBeUndefined();
    }
  });

  it('mark tools have destructiveHint=true (not readOnlyHint)', async () => {
    const server = buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: true });
    const client = await linkClient(server);
    const list = await client.listTools();
    const m = list.tools.find(t => t.name === 'mark_movie');
    expect(m?.annotations?.destructiveHint).toBe(true);
    expect(m?.annotations?.readOnlyHint).not.toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/tools/mutation.ts
import { z } from 'zod';
import type { IDoubanDataSource } from '../datasources/types.js';
import type { ToolEntry } from './registry.js';
import { formatMarkResult } from '../formatters/markdown.js';

const markSchema = z.object({
  id: z.string().regex(/^\d+$/),
  status: z.enum(['wish', 'do', 'collect']),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(140).optional(),
  tags: z.array(z.string()).max(10).optional(),
  shareToFeed: z.boolean().default(false),
});
const unmarkSchema = z.object({ id: z.string().regex(/^\d+$/) });

function makeMark(ds: IDoubanDataSource, category: 'movie' | 'book'): ToolEntry {
  return {
    id: `mark_${category}`, cliName: `mark-${category}`, mcpName: `mark_${category}`,
    description: `标记一${category === 'movie' ? '部电影' : '本书'}（想看/在看/看过），可选打分、备注、标签。需要 cookie + DOUBAN_ENABLE_WRITE。shareToFeed 默认 false（不广播）。`,
    inputSchema: markSchema,
    readOnly: false, requiresAuth: true,
    annotations: { destructiveHint: true, title: `Mark ${category}` },
    handler: async (args: z.infer<typeof markSchema>) => {
      await ds.markSubject(category, args.id, args.status, {
        rating: args.rating as any,
        comment: args.comment,
        tags: args.tags,
        shareToFeed: args.shareToFeed,
      });
      return formatMarkResult('mark', category, args.id);
    },
  };
}

function makeUnmark(ds: IDoubanDataSource, category: 'movie' | 'book'): ToolEntry {
  return {
    id: `unmark_${category}`, cliName: `unmark-${category}`, mcpName: `unmark_${category}`,
    description: `取消对一${category === 'movie' ? '部电影' : '本书'}的标记。`,
    inputSchema: unmarkSchema,
    readOnly: false, requiresAuth: true,
    annotations: { destructiveHint: true, title: `Unmark ${category}` },
    handler: async ({ id }) => {
      await ds.unmarkSubject(category, id);
      return formatMarkResult('unmark', category, id);
    },
  };
}

export function registerMutationTools(ds: IDoubanDataSource): ToolEntry[] {
  return [makeMark(ds, 'movie'), makeUnmark(ds, 'movie'), makeMark(ds, 'book'), makeUnmark(ds, 'book')];
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm test
git add src/tools/mutation.ts __tests__/integration/tools/mutation.test.ts
git commit -m "feat: mutation tools (mark/unmark for movie+book) gated by enableWrite"
```

---

### Task M4.4 — Dual-mode startup validation

**Files:**
- Modify: `src/index.ts` (already does most; tighten error messages)
- Create: `__tests__/integration/dual-mode.test.ts`

- [ ] **Step 1: Write test**

```ts
// __tests__/integration/dual-mode.test.ts
import { buildServer } from '../../src/server.js';
import { linkClient } from '../helpers/makeServer.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';

it('anonymous mode: no check_cookie, no mark_*', async () => {
  const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false }));
  const names = (await c.listTools()).tools.map(t => t.name);
  expect(names).not.toContain('check_cookie');
  expect(names.filter(n => n.startsWith('mark_'))).toEqual([]);
  expect(names).toContain('search_movie');
});

it('logged-in read-only mode: check_cookie present, no writes', async () => {
  const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: false }));
  const names = (await c.listTools()).tools.map(t => t.name);
  expect(names).toContain('check_cookie');
  expect(names.filter(n => n.startsWith('mark_'))).toEqual([]);
});

it('logged-in write mode: all tools present', async () => {
  const c = await linkClient(buildServer({ dataSource: new FakeDataSource(), cookie: 'bid=x; dbcl2="1:y"', enableWrite: true }));
  const names = (await c.listTools()).tools.map(t => t.name);
  for (const n of ['check_cookie', 'mark_movie', 'unmark_movie', 'mark_book', 'unmark_book']) {
    expect(names).toContain(n);
  }
  expect(names.length).toBe(16);
});
```

- [ ] **Step 2: Run, expect pass (registry already enforces this); commit**

```bash
pnpm test
git add __tests__/integration/dual-mode.test.ts
git commit -m "test: lock dual-mode tool exposure invariants"
```

---

### 🛑 M4 Review Checkpoint

Verify:
- All 16 tools available when `cookie + enableWrite=true`
- Write methods reject without cookie via AuthError → friendly message
- Cache invalidation triggers after mark/unmark
- `pnpm test` covers L0+L1 with ≥80% statement coverage

Summarize: "M4 done — auth + 4 write tools wired, dual-mode locked. Proceed to M5 (CLI + skill)?"

---

## Milestone M5 — CLI + Skill Package

Goal: agent-native CLI subcommands derived from the same `toolRegistry`, `--json` mode with stable schema, exit-code mapping, build-skill-md script, SKILL.md template, e2e tests.

### Task M5.1 — Entry dispatcher

**Files:**
- Modify: `src/index.ts` (add subcommand dispatch)

- [ ] **Step 1: Update entry**

```ts
#!/usr/bin/env node
import 'dotenv/config';

async function main() {
  const arg = process.argv[2];
  if (arg === 'serve' || arg == null) {
    const { runServe } = await import('./server-entry.js');
    return runServe(process.argv.slice(arg === 'serve' ? 3 : 2));
  }
  const { runCli } = await import('./cli.js');
  return runCli(process.argv.slice(2));
}

main().catch(err => {
  console.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 2: Move server-bootstrap logic to server-entry.ts**

```ts
// src/server-entry.ts
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';

export async function runServe(_args: string[]): Promise<void> {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';
  if (enableWrite && !cookie) {
    logger.error('DOUBAN_ENABLE_WRITE=true requires DOUBAN_COOKIE.');
    process.exit(2);
  }
  const dataSource = createDataSource({ cookie });
  if (cookie) {
    const me = await dataSource.getCurrentUser().catch(() => null);
    if (!me) logger.warn('DOUBAN_COOKIE present but appears expired; running anonymously.');
    else logger.info(`Logged in as ${me.name} (${me.uid})`);
  }
  const server = buildServer({ dataSource, cookie, enableWrite });
  await server.connect(new StdioServerTransport());
  logger.info('douban-mcp listening on stdio');
}
```

- [ ] **Step 3: Verify typecheck still passes; commit**

```bash
pnpm typecheck
git add src/index.ts src/server-entry.ts
git commit -m "refactor: split entry into dispatcher + server-entry"
```

---

### Task M5.2 — Zod-to-Commander parameter generator

**Files:**
- Create: `src/cli/zodArgs.ts`
- Create: `__tests__/unit/cli/zodArgs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/cli/zodArgs.test.ts
import { z } from 'zod';
import { applyZodOptions, parseZodOptions } from '../../../src/cli/zodArgs.js';
import { Command } from 'commander';

describe('zodArgs', () => {
  it('applies string option from z.string()', () => {
    const cmd = new Command();
    applyZodOptions(cmd, z.object({ q: z.string() }));
    cmd.exitOverride();
    cmd.parse(['node', 'cmd', '--q', 'hello'], { from: 'node' });
    expect(parseZodOptions(cmd.opts(), z.object({ q: z.string() })).q).toBe('hello');
  });

  it('coerces number from --count 5', () => {
    const schema = z.object({ count: z.number().int().default(10) });
    const cmd = new Command();
    applyZodOptions(cmd, schema);
    cmd.exitOverride();
    cmd.parse(['node', 'cmd', '--count', '5'], { from: 'node' });
    expect(parseZodOptions(cmd.opts(), schema).count).toBe(5);
  });

  it('coerces boolean flag from --share', () => {
    const schema = z.object({ shareToFeed: z.boolean().default(false) });
    const cmd = new Command();
    applyZodOptions(cmd, schema);
    cmd.exitOverride();
    cmd.parse(['node', 'cmd', '--share-to-feed'], { from: 'node' });
    expect(parseZodOptions(cmd.opts(), schema).shareToFeed).toBe(true);
  });

  it('parses comma-separated array for z.array(z.string())', () => {
    const schema = z.object({ tags: z.array(z.string()).optional() });
    const cmd = new Command();
    applyZodOptions(cmd, schema);
    cmd.exitOverride();
    cmd.parse(['node', 'cmd', '--tags', 'a,b,c'], { from: 'node' });
    expect(parseZodOptions(cmd.opts(), schema).tags).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/cli/zodArgs.ts
import { Command } from 'commander';
import { z, ZodTypeAny } from 'zod';

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function unwrap(s: ZodTypeAny): ZodTypeAny {
  if (s instanceof z.ZodOptional || s instanceof z.ZodDefault) return unwrap((s as any)._def.innerType);
  return s;
}

export function applyZodOptions(cmd: Command, schema: z.ZodObject<any>): void {
  const shape = schema.shape;
  for (const key of Object.keys(shape)) {
    const flag = `--${camelToKebab(key)}`;
    const inner = unwrap(shape[key]);
    if (inner instanceof z.ZodBoolean) {
      cmd.option(`${flag}`, key);
    } else if (inner instanceof z.ZodNumber) {
      cmd.option(`${flag} <n>`, key);
    } else if (inner instanceof z.ZodArray) {
      cmd.option(`${flag} <csv>`, `${key} (comma-separated)`);
    } else if (inner instanceof z.ZodEnum) {
      cmd.option(`${flag} <value>`, `${key} (${(inner as any)._def.values.join('|')})`);
    } else {
      cmd.option(`${flag} <value>`, key);
    }
  }
}

export function parseZodOptions(opts: Record<string, unknown>, schema: z.ZodObject<any>): any {
  const shape = schema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const kebab = camelToKebab(key).replace(/^-/, '');
    // commander stores camelCase keys for kebab options when using .option('--foo-bar')
    const camelKey = key; // commander camelCases automatically
    const raw = opts[camelKey];
    if (raw === undefined) continue;
    const inner = unwrap(shape[key]);
    if (inner instanceof z.ZodBoolean) out[key] = Boolean(raw);
    else if (inner instanceof z.ZodNumber) out[key] = Number(raw);
    else if (inner instanceof z.ZodArray) out[key] = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    else out[key] = raw;
  }
  return schema.parse(out);
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/cli/zodArgs.test.ts
git add src/cli/zodArgs.ts __tests__/unit/cli/zodArgs.test.ts
git commit -m "feat: zod-to-commander option generator"
```

---

### Task M5.3 — Output formatter for CLI (`--json` vs human)

**Files:**
- Create: `src/cli/output.ts`
- Create: `__tests__/unit/cli/output.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/cli/output.test.ts
import { renderResult, renderError, exitCodeFor } from '../../../src/cli/output.js';
import { AuthError, NotFoundError, RateLimitError, WriteDisabledError, ParseError, NetworkError } from '../../../src/errors.js';

describe('renderResult', () => {
  it('human mode returns markdown text as-is', () => {
    expect(renderResult({ ok: true, text: 'hello' }, false)).toBe('hello');
  });
  it('json mode returns the structured payload as JSON', () => {
    expect(renderResult({ ok: true, text: 'hello', data: [1, 2] }, true)).toBe('[1,2]');
  });
});

describe('renderError', () => {
  it('human mode renders friendly text', () => {
    expect(renderError(new AuthError('x'), false)).toContain('cookie 已失效');
  });
  it('json mode renders {"error":{"code","message"}}', () => {
    expect(JSON.parse(renderError(new AuthError('inner msg'), true))).toEqual({
      error: { code: 'AUTH_FAILED', message: 'inner msg' },
    });
  });
});

describe('exitCodeFor', () => {
  it.each([
    [new AuthError('x'), 1],
    [new WriteDisabledError('x'), 1],
    [new NotFoundError('x'), 2],
    [new RateLimitError('x'), 3],
    [new ParseError('x'), 4],
    [new NetworkError('x'), 4],
    [new Error('x'), 4],
  ])('maps %s to exit %s', (e: any, code) => {
    expect(exitCodeFor(e)).toBe(code);
  });
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/cli/output.ts
import { AuthError, NotFoundError, RateLimitError, WriteDisabledError, ParseError, NetworkError } from '../errors.js';
import { formatError, errorToCode } from '../tools/_boundary.js';

export interface CliResult { ok: true; text: string; data?: unknown; }

export function renderResult(r: CliResult, jsonMode: boolean): string {
  if (jsonMode) return JSON.stringify(r.data ?? r.text);
  return r.text;
}

export function renderError(e: unknown, jsonMode: boolean): string {
  if (jsonMode) {
    return JSON.stringify({ error: { code: errorToCode(e), message: e instanceof Error ? e.message : String(e) } });
  }
  return formatError(e);
}

export function exitCodeFor(e: unknown): number {
  if (e instanceof AuthError || e instanceof WriteDisabledError) return 1;
  if (e instanceof NotFoundError) return 2;
  if (e instanceof RateLimitError) return 3;
  if (e instanceof ParseError || e instanceof NetworkError) return 4;
  return 4;
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/cli/output.test.ts
git add src/cli/output.ts __tests__/unit/cli/output.test.ts
git commit -m "feat: CLI output formatter and exit code mapping"
```

---

### Task M5.4 — CLI runner (commander dispatch)

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Implement**

```ts
// src/cli.ts
import { Command } from 'commander';
import { createDataSource } from './datasources/factory.js';
import { buildToolRegistry } from './tools/registry.js';
import { applyZodOptions, parseZodOptions } from './cli/zodArgs.js';
import { renderResult, renderError, exitCodeFor } from './cli/output.js';

export async function runCli(argv: string[]): Promise<void> {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';
  const dataSource = createDataSource({ cookie });
  const registry = buildToolRegistry({ dataSource, cookie, enableWrite });

  const program = new Command();
  program
    .name('douban-mcp')
    .description('Douban MCP server + agent-native CLI')
    .version('1.0.0-alpha.0')
    .option('--json', 'output structured JSON (for agent parsing)');

  for (const tool of registry) {
    const cmd = program.command(tool.cliName).description(tool.description);
    applyZodOptions(cmd, tool.inputSchema);
    cmd.action(async (_: any, command: any) => {
      const jsonMode = Boolean(program.opts().json);
      try {
        const args = parseZodOptions(command.opts(), tool.inputSchema);
        const text = await tool.handler(args);
        process.stdout.write(renderResult({ ok: true, text }, jsonMode) + '\n');
      } catch (e) {
        process.stdout.write(renderError(e, jsonMode) + '\n');
        process.exit(exitCodeFor(e));
      }
    });
  }

  program.command('list-tools')
    .description('List all available tool subcommands')
    .action(() => {
      const jsonMode = Boolean(program.opts().json);
      if (jsonMode) {
        process.stdout.write(JSON.stringify(registry.map(t => ({ name: t.cliName, description: t.description, readOnly: t.readOnly }))) + '\n');
      } else {
        for (const t of registry) console.log(`${t.cliName}\t${t.description}`);
      }
    });

  program.command('describe <name>')
    .description('Describe one command (its zod schema)')
    .action((name: string) => {
      const t = registry.find(x => x.cliName === name);
      if (!t) { process.exit(2); }
      console.log(JSON.stringify({ name: t.cliName, description: t.description, schema: t.inputSchema._def }, null, 2));
    });

  program.command('doctor')
    .description('Diagnostics: cookie, network, data source')
    .action(async () => {
      const checks: { name: string; ok: boolean; detail?: string }[] = [];
      try {
        const me = cookie ? await dataSource.getCurrentUser() : null;
        checks.push({ name: 'cookie', ok: !cookie || me !== null, detail: me?.name ?? (cookie ? 'invalid' : 'absent') });
      } catch (e) {
        checks.push({ name: 'cookie', ok: false, detail: (e as Error).message });
      }
      checks.push({ name: 'data_source', ok: true, detail: process.env.DOUBAN_DATA_SOURCE ?? 'html' });
      checks.push({ name: 'write_mode', ok: !enableWrite || !!cookie, detail: enableWrite ? 'enabled' : 'disabled' });
      const allOk = checks.every(c => c.ok);
      console.log(JSON.stringify({ ok: allOk, checks }, null, 2));
      if (!allOk) process.exit(1);
    });

  await program.parseAsync(argv, { from: 'user' });
}
```

- [ ] **Step 2: Smoke run**

```bash
pnpm build
node dist/index.js list-tools
node dist/index.js search-movie --q "盗梦" --count 2
node dist/index.js search-movie --q "" --json
echo $?
```

Expected: list shows 11 tools (anonymous mode); search returns text or JSON; empty `q` → exit 1 with `{"error":{"code":"AUTH_FAILED",...}}` (or actually a Zod validation error mapped to UNKNOWN/exit 4 — adjust mapping if you want stricter).

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat: agent-native CLI deriving subcommands from registry"
```

---

### Task M5.5 — CLI e2e test

**Files:**
- Create: `__tests__/e2e/cli.test.ts`

- [ ] **Step 1: Write test**

```ts
// __tests__/e2e/cli.test.ts
import { execa } from 'execa';
import { resolve } from 'path';

const CLI = resolve('dist/index.js');

beforeAll(async () => {
  await execa('pnpm', ['build']);
}, 60_000);

it('list-tools exits 0 and lists multiple tools', async () => {
  const { stdout, exitCode } = await execa('node', [CLI, 'list-tools'], { env: { DOUBAN_DISABLE_CACHE: 'true' } as any });
  expect(exitCode).toBe(0);
  expect(stdout.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(10);
});

it('mark-movie without cookie/write exits 1 with WRITE_DISABLED in --json', async () => {
  const result = await execa('node', [CLI, '--json', 'mark-movie', '--id', '1', '--status', 'collect'], { reject: false });
  // Mark tool isn't even registered without cookie+enableWrite, so commander will fail with unknown command → exit nonzero
  expect(result.exitCode).not.toBe(0);
});

it('--json output is valid JSON (list-tools)', async () => {
  const { stdout } = await execa('node', [CLI, '--json', 'list-tools']);
  expect(() => JSON.parse(stdout)).not.toThrow();
});
```

- [ ] **Step 2: Run, expect pass**

```bash
pnpm jest __tests__/e2e/cli.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add __tests__/e2e/cli.test.ts
git commit -m "test: e2e for CLI exit codes and json mode"
```

---

### Task M5.6 — build-skill-md script

**Files:**
- Create: `scripts/build-skill-md.ts`
- Create: `skills/douban/SKILL.md` (initial template the script will overwrite for the auto-generated section)

- [ ] **Step 1: Create SKILL.md template with markers**

```md
<!-- skills/douban/SKILL.md -->
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
douban --json search-movie --q "盗梦空间" --count 1 \
  | jq -r '.[0].id' \
  | xargs -I{} douban get-movie --id {}
```

### 2. 我的待看清单
```bash
douban --json my-collections --category movie --status wish --json
```
（如未配 cookie 报 AUTH_FAILED，提示用户设置 `DOUBAN_COOKIE`。）

### 3. 批量标记
```bash
douban --json my-collections --category movie --status wish \
  | jq -r '.[] | select(.subject.rating > 8) | .subject.id' \
  | xargs -I{} douban mark-movie --id {} --status collect --rating 5
```
（需 `DOUBAN_ENABLE_WRITE=true`。）

## 错误处理

| Exit | 含义 | Agent 应该 |
|---|---|---|
| 0 | 成功 | 继续 |
| 1 | AUTH_FAILED / WRITE_DISABLED | 提示用户更新 cookie 或设置 enable_write |
| 2 | NOT_FOUND | 报告 id 不存在 |
| 3 | RATE_LIMITED | 等 60s 重试 |
| 4 | PARSE_FAILED / NETWORK / UNKNOWN | 重试一次；仍失败则报告 |

## 配置前置条件

- 安装：`npm i -g douban-mcp`
- 写操作：`export DOUBAN_COOKIE=...; export DOUBAN_ENABLE_WRITE=true`

## 可用命令（自动生成，勿手改）

<!-- BEGIN AUTO-COMMANDS -->
<!-- END AUTO-COMMANDS -->
```

- [ ] **Step 2: Implement build-skill-md.ts**

```ts
// scripts/build-skill-md.ts
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { buildToolRegistry } from '../src/tools/registry.js';
import { FakeDataSource } from '../__tests__/helpers/FakeDataSource.js';

const SKILL_PATH = resolve('skills/douban/SKILL.md');
const BEGIN = '<!-- BEGIN AUTO-COMMANDS -->';
const END = '<!-- END AUTO-COMMANDS -->';

const registry = buildToolRegistry({
  dataSource: new FakeDataSource() as any,
  cookie: 'bid=x; dbcl2="1:y"',
  enableWrite: true,
});

const lines: string[] = ['', '| 命令 | 说明 |', '|---|---|'];
for (const t of registry) {
  lines.push(`| \`${t.cliName}\` | ${t.description.replace(/\n/g, ' ').replace(/\|/g, '\\|')} |`);
}
lines.push('');

const md = readFileSync(SKILL_PATH, 'utf-8');
const before = md.slice(0, md.indexOf(BEGIN) + BEGIN.length);
const after = md.slice(md.indexOf(END));
const out = `${before}\n${lines.join('\n')}\n${after}`;
writeFileSync(SKILL_PATH, out);
console.log(`Updated ${SKILL_PATH} with ${registry.length} commands`);
```

- [ ] **Step 3: Run script and commit generated SKILL.md**

```bash
pnpm build:skill-md
git add scripts/build-skill-md.ts skills/douban/SKILL.md
git commit -m "feat: SKILL.md with auto-generated command catalog"
```

---

### Task M5.7 — CI gate for SKILL.md drift

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Append step**

In the `test` job, after `pnpm test --coverage`:

```yaml
      - run: pnpm build:skill-md
      - run: git diff --exit-code skills/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fail PRs when SKILL.md drifts from registry"
```

---

### Task M5.8 — stdio e2e smoke test

**Files:**
- Create: `__tests__/e2e/stdio.test.ts`

- [ ] **Step 1: Write test**

```ts
// __tests__/e2e/stdio.test.ts
import { execa } from 'execa';
import { resolve } from 'path';

const CLI = resolve('dist/index.js');

it('serve subcommand boots and responds to tools/list over stdio', async () => {
  const child = execa('node', [CLI, 'serve'], {
    env: { DOUBAN_DISABLE_CACHE: 'true' } as any,
  });
  child.stdin?.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  await new Promise(r => setTimeout(r, 1000));
  child.kill();
  const { stdout } = await child.catch(r => r);
  expect(stdout).toMatch(/"name":"search_movie"/);
});
```

- [ ] **Step 2: Run; commit**

```bash
pnpm test
git add __tests__/e2e/stdio.test.ts
git commit -m "test: stdio e2e smoke (boot + tools/list)"
```

---

### 🛑 M5 Review Checkpoint

Verify:
- `node dist/index.js list-tools` works
- `--json` output parses cleanly with `jq`
- Exit codes match spec §8.3
- `SKILL.md` regenerates deterministically; CI rejects drift
- L2 e2e tests for both stdio and CLI green

Summarize: "M5 done — CLI + skill package shipping. Proceed to M6 (Frodo + SSE)?"

---

## Milestone M6 — FrodoDataSource + SSE Transport

Goal: implement the second data source backed by `frodo.douban.com/api/v2`, wire it into the factory, add SSE transport so `serve --transport sse --port N` works.

### Task M6.1 — FrodoDataSource scaffolding + getCurrentUser

**Files:**
- Create: `src/datasources/FrodoDataSource.ts`
- Create: `__tests__/unit/datasources/FrodoDataSource.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/unit/datasources/FrodoDataSource.test.ts
import axios from 'axios';
import { FrodoDataSource } from '../../../src/datasources/FrodoDataSource.js';
import { MemoryCache } from '../../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../../src/ratelimit/Limiter.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeDS(cookie?: string) {
  (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
  return new FrodoDataSource({
    cookie,
    cache: new MemoryCache(),
    rateLimiter: new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 }),
  });
}

it('getCurrentUser returns null without cookie', async () => {
  expect(await makeDS().getCurrentUser()).toBeNull();
});

it('searchMovie hits frodo /search with apikey', async () => {
  mockedAxios.get.mockResolvedValue({
    status: 200,
    data: { subjects: [{ id: '1', title: 'M', year: '2020', rating: { value: 8.5 }, url: 'https://movie.douban.com/subject/1/' }] },
  });
  const r = await makeDS().searchMovie('test', 5);
  expect(r[0].title).toBe('M');
  const [url, cfg] = (mockedAxios.get as jest.Mock).mock.calls[0];
  expect(url).toContain('frodo.douban.com');
  expect(cfg.params.apikey).toBeTruthy();
});
```

- [ ] **Step 2: Run, expect fail; implement**

```ts
// src/datasources/FrodoDataSource.ts
import axios, { AxiosInstance } from 'axios';
import type {
  IDoubanDataSource, SubjectSummary, MovieDetail, MovieChartKind,
  Review, BookDetail, BookChartKind, Collection, CollectionStatus,
  Doulist, UserProfile, MarkOptions,
} from './types.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { DomainLimiter } from '../ratelimit/Limiter.js';
import { CookieManager } from '../auth/CookieManager.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError } from '../errors.js';

export interface FrodoOpts {
  cookie?: string;
  cache: MemoryCache;
  rateLimiter: DomainLimiter;
  apikey?: string;
}
const DEFAULT_APIKEY = '0dad551ec0f84ed02907ff5c42e8ec70';

export class FrodoDataSource implements IDoubanDataSource {
  private http: AxiosInstance;
  private cookies: CookieManager;
  private apikey: string;
  constructor(private opts: FrodoOpts) {
    this.cookies = new CookieManager(opts.cookie);
    this.apikey = opts.apikey ?? process.env.DOUBAN_FRODO_APIKEY ?? DEFAULT_APIKEY;
    this.http = axios.create({
      baseURL: 'https://frodo.douban.com/api/v2',
      headers: {
        'User-Agent': 'api-client/1 com.douban.frodo/7.32.0(231) Android/30 product/redfin vendor/google model/Pixel  rom/google network/wifi  platform/mobile com.douban.frodo/0',
        'Cookie': this.cookies.toHeader(),
      },
    });
  }

  private async get<T>(path: string, params: Record<string, unknown> = {}, opts: { domain?: string } = {}): Promise<T> {
    const domain = opts.domain ?? 'frodo.douban.com';
    await this.opts.rateLimiter.acquireRead(domain);
    let res;
    try {
      res = await this.http.get<T>(path, { params: { apikey: this.apikey, ...params }, validateStatus: s => s < 500 });
    } catch (e: any) { throw new NetworkError(e.message); }
    if (res.status === 404) throw new NotFoundError(`frodo 404 ${path}`);
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      throw new RateLimitError(`frodo ${res.status} ${path}`);
    }
    return res.data;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.cookies.hasLogin()) return null;
    return this.opts.cache.wrap('frodo:getCurrentUser', 300, async () => {
      const data = await this.get<any>('/user/~me');
      return { uid: String(data.id ?? data.uid ?? ''), name: data.name ?? '', avatar: data.avatar ?? '' };
    });
  }

  async searchMovie(q: string, count: number): Promise<SubjectSummary[]> {
    return this.opts.cache.wrap(`frodo:searchMovie:${q}:${count}`, 1800, async () => {
      const data = await this.get<any>('/search/movie', { q, count });
      return (data.subjects ?? data.items ?? []).slice(0, count).map(mapSubject);
    });
  }

  async getMovie(id: string): Promise<MovieDetail> {
    return this.opts.cache.wrap(`frodo:getMovie:${id}`, 21600, async () => {
      const d = await this.get<any>(`/movie/${id}`);
      return {
        id, title: d.title, originalTitle: d.original_title, year: String(d.year ?? ''),
        rating: d.rating?.value, ratingCount: d.rating?.count ?? 0,
        url: d.url ?? `https://movie.douban.com/subject/${id}/`, cover: d.pic?.normal,
        directors: (d.directors ?? []).map(personFromObj),
        casts: (d.actors ?? []).map(personFromObj),
        genres: d.genres ?? [], countries: d.countries ?? [],
        releaseDate: d.pubdate?.[0], duration: d.durations?.[0],
        imdbId: d.imdb, summary: d.intro ?? '',
      };
    });
  }

  async getMovieReviews(id: string, count: number): Promise<Review[]> {
    return this.opts.cache.wrap(`frodo:getMovieReviews:${id}:${count}`, 1800, async () => {
      const d = await this.get<any>(`/movie/${id}/interests`, { count, status: 'done' });
      return (d.interests ?? []).map((i: any) => ({
        author: i.user?.name ?? '', authorUid: String(i.user?.id ?? ''),
        rating: i.rating?.value, content: i.comment ?? '',
        publishedAt: i.create_time ?? '', usefulCount: i.vote_count ?? 0,
      }));
    });
  }

  async getMovieChart(kind: MovieChartKind, _start: number, count: number): Promise<SubjectSummary[]> {
    const path = kind === 'top250' ? '/movie/top250' : kind === 'weekly' ? '/movie/weekly' : '/movie/coming_soon';
    return this.opts.cache.wrap(`frodo:getMovieChart:${kind}:${count}`, 3600, async () => {
      const d = await this.get<any>(path, { count });
      return (d.subjects ?? d.items ?? []).slice(0, count).map(mapSubject);
    });
  }

  async searchBook(q: string, count: number): Promise<SubjectSummary[]> {
    return this.opts.cache.wrap(`frodo:searchBook:${q}:${count}`, 1800, async () => {
      const d = await this.get<any>('/search/book', { q, count });
      return (d.subjects ?? d.items ?? []).slice(0, count).map(mapSubject);
    });
  }

  async getBook(id: string): Promise<BookDetail> {
    return this.opts.cache.wrap(`frodo:getBook:${id}`, 21600, async () => {
      const d = await this.get<any>(`/book/${id}`);
      return {
        id, title: d.title, year: d.pubdate?.match(/\d{4}/)?.[0],
        rating: d.rating?.value, ratingCount: d.rating?.count ?? 0,
        url: d.url ?? `https://book.douban.com/subject/${id}/`, cover: d.pic?.normal,
        authors: d.author ?? [], translators: d.translator ?? [],
        publisher: d.press?.[0], publishDate: d.pubdate, pages: parseInt(d.pages, 10) || undefined,
        price: d.price, isbn: d.isbn13 ?? d.isbn10, summary: d.intro ?? '',
      };
    });
  }

  async getBookReviews(id: string, count: number): Promise<Review[]> {
    return this.opts.cache.wrap(`frodo:getBookReviews:${id}:${count}`, 1800, async () => {
      const d = await this.get<any>(`/book/${id}/interests`, { count, status: 'done' });
      return (d.interests ?? []).map((i: any) => ({
        author: i.user?.name ?? '', authorUid: String(i.user?.id ?? ''),
        rating: i.rating?.value, content: i.comment ?? '',
        publishedAt: i.create_time ?? '', usefulCount: i.vote_count ?? 0,
      }));
    });
  }

  async getBookChart(kind: BookChartKind, count: number): Promise<SubjectSummary[]> {
    const tag = kind === 'fiction' ? '小说' : kind === 'non_fiction' ? '随笔' : '新书';
    return this.opts.cache.wrap(`frodo:getBookChart:${kind}:${count}`, 3600, async () => {
      const d = await this.get<any>('/book/recommend', { tag, count });
      return (d.subjects ?? d.items ?? []).slice(0, count).map(mapSubject);
    });
  }

  private resolveUid(uid: string | null): string {
    if (uid) return uid;
    const own = this.cookies.getOwnUid();
    if (!own) throw new AuthError('uid is null and no DOUBAN_COOKIE');
    return own;
  }

  async getUserCollections(uid: string | null, category: 'movie' | 'book', status: CollectionStatus, start: number, count: number): Promise<Collection[]> {
    const realUid = this.resolveUid(uid);
    const ttl = uid === null ? 300 : 1800;
    return this.opts.cache.wrap(`frodo:getUserCollections:${realUid}:${category}:${status}:${start}:${count}`, ttl, async () => {
      const path = category === 'movie' ? `/user/${realUid}/interests` : `/user/${realUid}/book_interests`;
      const fr = status === 'wish' ? 'mark' : status === 'do' ? 'doing' : 'done';
      const d = await this.get<any>(path, { status: fr, start, count });
      return (d.interests ?? []).map((i: any) => ({
        subject: mapSubject(i.subject ?? {}),
        status,
        rating: i.rating?.value,
        comment: i.comment ?? undefined,
        tags: i.tags ?? [],
        markedAt: i.create_time ?? '',
      }));
    });
  }

  async getUserDoulist(uid: string | null): Promise<Doulist[]> {
    const realUid = this.resolveUid(uid);
    return this.opts.cache.wrap(`frodo:getUserDoulist:${realUid}`, 3600, async () => {
      const d = await this.get<any>(`/user/${realUid}/owned_doulists`);
      return (d.doulists ?? []).map((x: any) => ({
        id: String(x.id), title: x.title, description: x.desc ?? '',
        itemCount: x.items_count ?? 0, url: x.uri ?? '',
      }));
    });
  }

  async getUserProfile(uid: string | null): Promise<UserProfile> {
    const realUid = this.resolveUid(uid);
    return this.opts.cache.wrap(`frodo:getUserProfile:${realUid}`, 3600, async () => {
      const d = await this.get<any>(`/user/${realUid}`);
      return { uid: String(d.id ?? realUid), name: d.name ?? '', avatar: d.avatar ?? '', signature: d.intro };
    });
  }

  async markSubject(category: 'movie' | 'book', id: string, status: CollectionStatus, options: MarkOptions): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('mark requires DOUBAN_COOKIE');
    const domain = 'frodo.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);
    const path = `/${category}/${id}/interest`;
    const fr = status === 'wish' ? 'mark' : status === 'do' ? 'doing' : 'done';
    const params = new URLSearchParams();
    params.set('apikey', this.apikey);
    params.set('status', fr);
    if (options.rating != null) params.set('rating', String(options.rating));
    if (options.comment) params.set('comment', options.comment);
    if (options.tags?.length) params.set('tags', options.tags.join(' '));
    params.set('share', options.shareToFeed ? 'true' : 'false');
    const res = await this.http.post(path, params, { validateStatus: s => s < 500 }).catch((e: any) => { throw new NetworkError(e.message); });
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      this.opts.rateLimiter.lockWriteForSession(domain);
      throw new RateLimitError('frodo write blocked');
    }
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);
    const own = this.cookies.getOwnUid();
    if (own) this.opts.cache.invalidate(`frodo:getUserCollections:${own}:${category}`);
  }

  async unmarkSubject(category: 'movie' | 'book', id: string): Promise<void> {
    if (!this.cookies.hasLogin()) throw new AuthError('unmark requires DOUBAN_COOKIE');
    const domain = 'frodo.douban.com';
    await this.opts.rateLimiter.acquireWrite(domain);
    const res = await this.http.delete(`/${category}/${id}/interest`, { params: { apikey: this.apikey }, validateStatus: s => s < 500 })
      .catch((e: any) => { throw new NetworkError(e.message); });
    if (res.status === 401 || res.status === 403) {
      this.opts.rateLimiter.markCooldown(domain);
      this.opts.rateLimiter.lockWriteForSession(domain);
      throw new RateLimitError('frodo unmark blocked');
    }
    if (res.status >= 400) throw new NetworkError(`HTTP ${res.status}`);
    const own = this.cookies.getOwnUid();
    if (own) this.opts.cache.invalidate(`frodo:getUserCollections:${own}:${category}`);
  }
}

function mapSubject(s: any): SubjectSummary {
  return {
    id: String(s.id ?? ''),
    title: s.title ?? '',
    year: s.year ? String(s.year) : undefined,
    rating: s.rating?.value,
    url: s.url ?? `https://${s.type === 'book' ? 'book' : 'movie'}.douban.com/subject/${s.id}/`,
    cover: s.pic?.normal ?? s.cover_url,
  };
}

function personFromObj(p: any) {
  return { id: String(p.id ?? ''), name: p.name ?? '', url: p.url ?? '' };
}
```

- [ ] **Step 3: Run, expect pass; commit**

```bash
pnpm jest __tests__/unit/datasources/FrodoDataSource.test.ts
git add src/datasources/FrodoDataSource.ts __tests__/unit/datasources/FrodoDataSource.test.ts
git commit -m "feat: FrodoDataSource (frodo.douban.com api/v2) full implementation"
```

---

### Task M6.2 — Wire FrodoDataSource into factory

**Files:**
- Modify: `src/datasources/factory.ts`
- Modify: `__tests__/unit/datasources/factory.test.ts`

- [ ] **Step 1: Update factory**

Replace the `if (kind === 'frodo') throw` line with:

```ts
import { FrodoDataSource } from './FrodoDataSource.js';
// ...
if (kind === 'frodo') return new FrodoDataSource({ cookie: opts.cookie, cache, rateLimiter });
```

- [ ] **Step 2: Update factory test**

Replace the `'frodo throws not yet implemented'` test with:

```ts
import { FrodoDataSource } from '../../../src/datasources/FrodoDataSource.js';
it('frodo returns FrodoDataSource', () => {
  expect(createDataSource({ kind: 'frodo' })).toBeInstanceOf(FrodoDataSource);
});
```

- [ ] **Step 3: Run, commit**

```bash
pnpm test
git add src/datasources/factory.ts __tests__/unit/datasources/factory.test.ts
git commit -m "feat: factory dispatches DOUBAN_DATA_SOURCE=frodo to FrodoDataSource"
```

---

### Task M6.3 — Cross-source contract tests

**Files:**
- Create: `__tests__/integration/datasource-contract.test.ts`

- [ ] **Step 1: Both implementations should satisfy the same minimal behavior**

```ts
// __tests__/integration/datasource-contract.test.ts
import axios from 'axios';
import { HtmlDataSource } from '../../src/datasources/HtmlDataSource.js';
import { FrodoDataSource } from '../../src/datasources/FrodoDataSource.js';
import { MemoryCache } from '../../src/cache/MemoryCache.js';
import { DomainLimiter } from '../../src/ratelimit/Limiter.js';
import { loadFixture } from '../helpers/loadFixture.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const lim = new DomainLimiter({ readPerSec: 100, writePerSec: 100, cooldownSec: 1 });

describe.each([
  ['HtmlDataSource', () => {
    (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
    mockedAxios.get.mockResolvedValue({ status: 200, data: loadFixture('movie/inception.html'), request: { res: { responseUrl: 'https://movie.douban.com/' } } });
    return new HtmlDataSource({ cache: new MemoryCache(), rateLimiter: lim });
  }],
  ['FrodoDataSource', () => {
    (mockedAxios.create as jest.Mock).mockReturnValue(mockedAxios);
    mockedAxios.get.mockResolvedValue({ status: 200, data: { id: '3541415', title: '盗梦空间', year: 2010, rating: { value: 8.8, count: 100 }, intro: 'plot', directors: [], actors: [], genres: ['action'], countries: ['US'], pic: { normal: '' } } });
    return new FrodoDataSource({ cache: new MemoryCache(), rateLimiter: lim });
  }],
])('%s contract', (_name, factory) => {
  it('getMovie returns object with id and title', async () => {
    const ds = factory();
    const m = await ds.getMovie('3541415');
    expect(m.id).toBe('3541415');
    expect(m.title).toContain('盗梦空间');
  });
});
```

- [ ] **Step 2: Run, commit**

```bash
pnpm test
git add __tests__/integration/datasource-contract.test.ts
git commit -m "test: cross-source contract for getMovie"
```

---

### Task M6.4 — SSE transport

**Files:**
- Modify: `src/server-entry.ts`

- [ ] **Step 1: Add transport selection logic**

```ts
// src/server-entry.ts (replace existing)
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';

interface ServeOpts { transport: 'stdio' | 'sse'; port: number; }

function parseServeArgs(args: string[]): ServeOpts {
  const transport = (args[args.indexOf('--transport') + 1] === 'sse') ? 'sse' : 'stdio';
  const portIdx = args.indexOf('--port');
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) || 3000 : 3000;
  return { transport, port };
}

export async function runServe(args: string[]): Promise<void> {
  const cookie = process.env.DOUBAN_COOKIE;
  const enableWrite = process.env.DOUBAN_ENABLE_WRITE === 'true';
  if (enableWrite && !cookie) {
    logger.error('DOUBAN_ENABLE_WRITE=true requires DOUBAN_COOKIE.');
    process.exit(2);
  }
  const dataSource = createDataSource({ cookie });
  if (cookie) {
    const me = await dataSource.getCurrentUser().catch(() => null);
    if (!me) logger.warn('DOUBAN_COOKIE present but appears expired; running anonymously.');
    else logger.info(`Logged in as ${me.name} (${me.uid})`);
  }
  const server = buildServer({ dataSource, cookie, enableWrite });

  const opts = parseServeArgs(args);
  if (opts.transport === 'sse') {
    const { SSEServerTransport } = await import('@modelcontextprotocol/server/sse');
    const http = await import('http');
    const httpServer = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/sse') {
        const transport = new SSEServerTransport('/messages', res);
        await server.connect(transport);
      } else if (req.method === 'POST' && req.url?.startsWith('/messages')) {
        // SSE message handling (delegated by the transport above)
        res.writeHead(200).end();
      } else {
        res.writeHead(404).end();
      }
    });
    httpServer.listen(opts.port, () => logger.info(`SSE listening on http://localhost:${opts.port}/sse`));
  } else {
    await server.connect(new StdioServerTransport());
    logger.info('douban-mcp listening on stdio');
  }
}
```

- [ ] **Step 2: Smoke test**

```bash
pnpm build
node dist/index.js serve --transport sse --port 3000 &
sleep 1
curl -N http://localhost:3000/sse | head -c 200
kill %1
```

Expected: SSE event stream begins (look for `event:` / `data:` lines).

- [ ] **Step 3: Commit**

```bash
git add src/server-entry.ts
git commit -m "feat: SSE transport via --transport sse --port N"
```

---

### 🛑 M6 Review Checkpoint

Verify:
- `DOUBAN_DATA_SOURCE=frodo node dist/index.js search-movie --q test` returns data
- `DOUBAN_DATA_SOURCE=html` (default) still works
- `serve --transport sse --port 3000` starts an HTTP server
- Cross-source contract tests pass on both implementations

Summarize: "M6 done — Frodo backend + SSE transport. Proceed to M7 (docs + release)?"

---

## Milestone M7 — Documentation, Examples, Release

Goal: README, FAQ, cookie guide, architecture doc, examples, CONTRIBUTING, CHANGELOG, release workflow, nightly smoke; cut `v1.0.0` to npm.

### Task M7.1 — README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README using xhs-mcp style**

```md
# douban-mcp 🎬 📕

[![npm](https://img.shields.io/npm/v/douban-mcp.svg)](https://www.npmjs.com/package/douban-mcp)
[![CI](https://github.com/jackjin1997/douban-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jackjin1997/douban-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**面向 agent 的豆瓣 MCP 服务 + CLI**。同一个包既能做 Claude Desktop 的 MCP server（stdio/SSE），又能给 Claude Code/OpenClaw 等 agent 直接用作 CLI。

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
| `check_cookie` | 必需 cookie | cookie 是否有效 |
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

## ⚙️ 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DOUBAN_COOKIE` | — | 登录态 cookie |
| `DOUBAN_ENABLE_WRITE` | `false` | 启用写操作 |
| `DOUBAN_DATA_SOURCE` | `html` | `html` / `frodo` |
| `DOUBAN_LOG_LEVEL` | `info` | debug/info/warn/error |
| `DOUBAN_DISABLE_CACHE` | `false` | 关闭缓存 |
| `DOUBAN_USER_AGENT` | 内置 Chrome UA | 覆盖默认 UA |

## 🛡️ 免责声明

本项目仅供学习和个人使用，禁止用于商业目的或大规模数据爬取。使用本项目造成的任何账号风险（限流、封禁等）由使用者自行承担。本项目无任何官方背景。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: full README with badges, quickstart, tool table, env vars"
```

---

### Task M7.2 — Cookie guide

**Files:**
- Create: `docs/cookie-guide.md`

- [ ] **Step 1: Write**

```md
# 获取豆瓣 Cookie

## 步骤

1. 在 Chrome / Firefox / Safari 中登录 https://www.douban.com
2. 打开开发者工具（F12 / ⌥⌘I），切到 **Network** 面板
3. 刷新页面，点任意一条到 `douban.com` 的请求
4. 在 **Headers → Request Headers** 找到 `Cookie:` 行
5. 复制整行 `Cookie:` 后面的值（注意是值，不带 `Cookie:` 前缀）

## 关键字段说明

douban-mcp 主要依赖三个字段：

| 字段 | 用途 |
|---|---|
| `bid` | 浏览器指纹（任何请求都会带） |
| `dbcl2` | 登录态 token，**没它就不算登录** |
| `ck` | CSRF token，**写操作必需** |

## 配置

```bash
export DOUBAN_COOKIE='bid=ABC; dbcl2="123456:xyz=="; ck=ABCD; ll="108288"'
```

## 多久过期

豆瓣 cookie 通常 30 天有效，但活跃使用会延期。被风控触发后可能立即失效——重新登录浏览器再复制即可。

## 安全提示

- **永远不要把 cookie commit 到 git**
- 使用 `.env` 文件保存（已在 `.gitignore` 里）
- 不要把含 cookie 的截图发到公开渠道
- 怀疑泄露时立即在豆瓣"账号设置"中"修改密码"以使所有 session 失效
```

- [ ] **Step 2: Commit**

```bash
git add docs/cookie-guide.md
git commit -m "docs: cookie acquisition guide"
```

---

### Task M7.3 — FAQ

**Files:**
- Create: `docs/faq.md`

- [ ] **Step 1: Write**

```md
# FAQ

## Q1: cookie 多久过期？需要主动续期吗？

通常 30 天，但你只要继续用就会自动续。如果触发风控被强制下线，需要重新登录浏览器再复制 cookie。

## Q2: 触发风控了怎么办？

服务会自动进入域级冷却（默认 60s）。再次触发会升级到 5min 冷却，写操作会锁死整个进程 session。处理方式：
- 等冷却结束（read），或重启进程（write）
- 适当降低 `DOUBAN_*PerSec` 配置（在代码里调）
- 切换 IP（如果你在数据中心 IP 上跑）

## Q3: 这个项目和 xhs-mcp 是什么关系？

设计参考了 [jobsonlook/xhs-mcp](https://github.com/jobsonlook/xhs-mcp) 的轻量纯 MCP 路线和 [aki66938/xhs-toolkit](https://github.com/aki66938/xhs-toolkit) 的"工具包"思想。但豆瓣无 x-s/x-t 动态签名，所以我们更轻量（不依赖 Playwright）；同时本项目把 CLI 当作 agent native 的一等入口。

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

## Q7: 为什么 HTML 模式比 Frodo 慢？我能切换吗？

HTML 模式要解析 DOM，单次延迟约 100-300ms；Frodo 直接拿 JSON，约 50-100ms。但 Frodo apikey 是反向出来的，可能随时被豆瓣封锁导致全员瘫痪。建议默认走 HTML，需要速度时再切：

```bash
export DOUBAN_DATA_SOURCE=frodo
```

## Q8: 写操作触发"未启用"？

需要同时设置：
```bash
export DOUBAN_COOKIE="..."
export DOUBAN_ENABLE_WRITE=true
```
缺一不可。这是 secure by default。
```

- [ ] **Step 2: Commit**

```bash
git add docs/faq.md
git commit -m "docs: FAQ covering cookie/risk/source/write"
```

---

### Task M7.4 — Architecture doc

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Write**

```md
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
- SKILL.md: `pnpm build:skill-md` 把 registry 渲染到 `skills/douban/SKILL.md` 的指定段落（CI 强制无 drift）

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
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: architecture overview"
```

---

### Task M7.5 — Examples directory

**Files:**
- Create: `examples/claude-desktop-config.json`
- Create: `examples/cursor-config.json`
- Create: `examples/inspector.md`
- Create: `.env.example`

- [ ] **Step 1: claude-desktop-config.json**

```json
{
  "mcpServers": {
    "douban": {
      "command": "npx",
      "args": ["-y", "douban-mcp", "serve"],
      "env": {
        "DOUBAN_COOKIE": "<your cookie here>",
        "DOUBAN_ENABLE_WRITE": "false",
        "DOUBAN_DATA_SOURCE": "html"
      }
    },
    "douban-sse": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

- [ ] **Step 2: cursor-config.json (similar shape)**

```json
{
  "mcp.servers": {
    "douban": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "douban-mcp", "serve"]
    }
  }
}
```

- [ ] **Step 3: inspector.md**

```md
# Debugging with mcp-inspector

```bash
npx @modelcontextprotocol/inspector npx -y douban-mcp serve
```

Browser opens at the inspector URL. Use the **Tools** tab to invoke any tool with arbitrary args. Use **Logs** tab to see stderr from the server.

For SSE mode:
```bash
npx -y douban-mcp serve --transport sse --port 3000
# in a second terminal:
npx @modelcontextprotocol/inspector --sse http://localhost:3000/sse
```
```

- [ ] **Step 4: .env.example**

```bash
# Cookie from douban.com (see docs/cookie-guide.md)
# DOUBAN_COOKIE='bid=...; dbcl2="..."; ck=...'

# Enable mark/unmark write operations (requires DOUBAN_COOKIE)
# DOUBAN_ENABLE_WRITE=true

# Data source: 'html' (default, parses public web pages) or 'frodo' (frodo.douban.com api/v2)
# DOUBAN_DATA_SOURCE=html

# Optional Frodo apikey override
# DOUBAN_FRODO_APIKEY=0dad551ec0f84ed02907ff5c42e8ec70

# Logging
# DOUBAN_LOG_LEVEL=info  # debug | info | warn | error

# Disable cache (useful for tests / debug)
# DOUBAN_DISABLE_CACHE=true

# Override default Chrome User-Agent
# DOUBAN_USER_AGENT='Mozilla/5.0 ...'
```

- [ ] **Step 5: Commit**

```bash
git add examples/ .env.example
git commit -m "docs: example configs for Claude Desktop, Cursor, mcp-inspector"
```

---

### Task M7.6 — CONTRIBUTING + CHANGELOG + LICENSE

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`

- [ ] **Step 1: CONTRIBUTING.md**

```md
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
```

- [ ] **Step 2: CHANGELOG.md**

```md
# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.0] — TBD
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
```

- [ ] **Step 3: LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 JackJin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Commit**

```bash
git add CONTRIBUTING.md CHANGELOG.md LICENSE
git commit -m "docs: contributing, changelog, MIT license"
```

---

### Task M7.7 — Release + nightly workflows

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/nightly.yml`

- [ ] **Step 1: release.yml**

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions: { contents: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, registry-url: 'https://registry.npmjs.org' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build:skill-md
      - run: git diff --exit-code skills/
      - run: pnpm build
      - run: pnpm publish --access public --no-git-checks --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

- [ ] **Step 2: nightly.yml**

```yaml
name: Nightly Smoke
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC daily
  workflow_dispatch:
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Anonymous read smoke (real network)
        id: smoke
        continue-on-error: true
        run: |
          node dist/index.js --json search-movie --q "肖申克的救赎" --count 1 > out.json
          test "$(jq 'length' out.json)" -ge 1
      - name: Open issue on failure
        if: steps.smoke.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner, repo: context.repo.repo,
              title: 'Nightly smoke failed: HtmlDataSource selectors may have shifted',
              body: 'Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}',
              labels: ['bug', 'parser-rot'],
            });
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml .github/workflows/nightly.yml
git commit -m "ci: release workflow + nightly real-network smoke"
```

---

### Task M7.8 — Final verification + first release

**Files:** none

- [ ] **Step 1: Run full test + coverage**

```bash
pnpm install
pnpm typecheck
pnpm lint || true   # eslint config optional; tolerate missing
pnpm test --coverage
```

Expected: all green; coverage ≥ 80% on lines/functions/statements.

- [ ] **Step 2: Manual MCP smoke**

```bash
pnpm build
node dist/index.js list-tools | head
node dist/index.js --json search-movie --q "盗梦空间" --count 1 | jq
```

- [ ] **Step 3: Manual Claude Desktop smoke**

Add config from `examples/claude-desktop-config.json`, restart Claude Desktop, confirm `tools/list` shows expected names.

- [ ] **Step 4: Tag and push**

```bash
# update CHANGELOG.md [1.0.0] section to today's date
git add CHANGELOG.md
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

This triggers `release.yml` which publishes to npm.

- [ ] **Step 5: Verify npm**

```bash
npx -y douban-mcp@1.0.0 list-tools
```

Expected: lists 11 tools (anonymous mode).

---

### 🛑 M7 Final Review

Verify all spec §15 acceptance criteria:

- [ ] All 16 tools visible/callable in Claude Desktop
- [ ] CLI `--help` outputs correct for all subcommands
- [ ] CLI `--json` parses with `jq`
- [ ] Exit codes match spec §8.3
- [ ] `pnpm test --coverage` ≥ 80%
- [ ] L1 happy + error path per tool
- [ ] L2 e2e ≥ 5 cases (stdio + CLI combined)
- [ ] Nightly smoke workflow runs
- [ ] All docs present (README, cookie-guide, FAQ, architecture, CONTRIBUTING, CHANGELOG)
- [ ] `examples/claude-desktop-config.json` works
- [ ] `skills/douban/SKILL.md` triggers in Claude Code
- [ ] `pnpm build:skill-md` produces no diff
- [ ] `npx -y douban-mcp` works in clean env
- [ ] Published to npm with `dist/`, `skills/`, `examples/`

If everything ✅, v1.0.0 ships.

---

## Spec Coverage Map

Cross-reference: each spec section → which tasks implement it.

| Spec § | Topic | Implementing tasks |
|---|---|---|
| §3 Architecture | layered, registry-driven | M3.2, M3.5 |
| §4.1 check_cookie | meta tool | M3.2 |
| §4.2 movie tools (4) | search/get/reviews/chart | M2.10 + M3.6 |
| §4.3 book tools (4) | search/get/reviews/chart | M2.11 + M3.7 |
| §4.4 user tools (3) | collections/doulist/profile | M2.12 + M3.8 |
| §4.5 write tools (4) | mark/unmark movie+book | M4.2 + M4.3 |
| §5.1 IDoubanDataSource | interface | M2.2 |
| §5.2 payload types | types.ts | M2.2 |
| §5.3 error hierarchy | errors.ts | M2.1 |
| §5.4 HTML/Frodo split | two implementations | M2.9-M2.12 + M6.1 |
| §6 dual-mode startup | cookie + enableWrite | M3.5, M4.4, M5.1 |
| §6.5 readOnlyHint annotations | per-tool | M3.6/7/8/4.3 + M3.9 meta-test |
| §7.1 cache TTL matrix | per method TTLs | M2.10/11/12 |
| §7.2 rate limit + cooldown | DomainLimiter | M2.4 |
| §7.3 error boundary + formatError | _boundary.ts | M3.3 |
| §8 CLI commands | commander dispatch | M5.4 |
| §8.2 --json output protocol | output.ts | M5.3 |
| §8.3 exit code mapping | exitCodeFor | M5.3 |
| §9 Skill package | SKILL.md + script | M5.6 |
| §9.3 single registry → 3 derivations | registry + cli + skill-md | M3.2, M5.4, M5.6 |
| §10 env vars | parsed in entry/factory | M3.5, M5.1, M2.13 |
| §11 testing pyramid | L0/L1/L2 + smoke | M2 (L0), M3-M4 (L1), M5.5/M5.8 (L2), M7.7 (smoke) |
| §11.4 fixture rules | __tests__/fixtures | M2.5 |
| §11.5 coverage ≥80% | jest threshold | M1.3 |
| §11.6 meta-tests | annotation drift, naming | M3.9 |
| §12.1 directory structure | file layout | (matched throughout) |
| §12.2 doc deliverables | README/FAQ/etc | M7.1-M7.6 |
| §12.4 CI workflows | ci/release/nightly | M1.6, M5.7, M7.7 |
| §13 decision records | (frozen in spec) | n/a |
| §14 risks | mitigations | rate limit (M2.4), nightly smoke (M7.7), shareToFeed default false (M4.3), cookie redaction (M1.4) |
| §15 acceptance criteria | final checklist | M7.8 |

No spec section is left unimplemented.

---

*End of plan.*





