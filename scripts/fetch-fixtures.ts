/**
 * Fetch real HTML fixtures from Douban for use in parser unit tests.
 * Run: node --import tsx scripts/fetch-fixtures.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fixturesDir = join(root, '__tests__', 'fixtures');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchResult {
  ok: boolean;
  html: string;
  status: number;
  reason?: string;
}

async function fetchPage(url: string, referer?: string): Promise<FetchResult> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (referer) headers['Referer'] = referer;

  try {
    const resp = await fetch(url, {
      headers,
      redirect: 'follow',
    });

    const html = await resp.text();

    if (resp.status >= 400) {
      return { ok: false, html, status: resp.status, reason: `HTTP ${resp.status}` };
    }

    if (
      html.includes('/sec/captcha') ||
      html.includes('检测到您的登录') ||
      html.includes('robot') ||
      (html.length < 2000 && html.includes('verify'))
    ) {
      return {
        ok: false,
        html,
        status: resp.status,
        reason: 'Anti-bot page (captcha/verify)',
      };
    }

    return { ok: true, html, status: resp.status };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, html: '', status: 0, reason: `Network error: ${msg}` };
  }
}

let successCount = 0;
let failCount = 0;

async function savePage(url: string, savePath: string, referer?: string): Promise<boolean> {
  console.log(`[fetch] ${url}`);
  const result = await fetchPage(url, referer);

  if (!result.ok || result.html.length < 5000) {
    const reason = !result.ok
      ? result.reason
      : `HTML too small (${result.html.length} bytes, expected ≥ 5KB)`;
    console.log(`[fail]  ${url} — ${reason}`);
    failCount++;
    return false;
  }

  mkdirSync(dirname(savePath), { recursive: true });
  writeFileSync(savePath, result.html, 'utf-8');
  console.log(`[ok]    ${savePath} (${result.html.length} bytes)`);
  successCount++;
  return true;
}

function extractUids(html: string): string[] {
  const BLOCKED = new Set(['mine', 'null', 'people', 'login', 'register', 'settings', 'logout']);
  const matches = [...html.matchAll(/\/people\/([a-zA-Z0-9_-]+)\//g)];
  const uids: string[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const uid = m[1];
    if (!BLOCKED.has(uid) && !seen.has(uid) && uid.length >= 3) {
      uids.push(uid);
      seen.add(uid);
      if (uids.length >= 10) break; // collect a few candidates
    }
  }

  return uids;
}

async function fetchUserPages(uid: string): Promise<boolean> {
  const userPages: Array<{ url: string; save: string; referer: string; acceptKeyword?: string }> = [
    {
      url: `https://movie.douban.com/people/${uid}/collect`,
      save: join(fixturesDir, 'user', 'collections-watched.html'),
      referer: 'https://movie.douban.com/',
    },
    {
      url: `https://www.douban.com/people/${uid}/`,
      save: join(fixturesDir, 'user', 'profile.html'),
      referer: 'https://www.douban.com/',
    },
    {
      url: `https://www.douban.com/people/${uid}/doulists/all`,
      save: join(fixturesDir, 'user', 'doulist.html'),
      referer: `https://www.douban.com/people/${uid}/`,
      // Douban may return 403 for doulist page if user has no public doulists,
      // but the HTML still contains '豆列' in the nav — accept it as valid fixture.
      acceptKeyword: '豆列',
    },
  ];

  let allOk = true;
  for (const page of userPages) {
    const result = await fetchPage(page.url, page.referer);
    const isValid =
      result.html.length >= 5000 &&
      (result.ok || (page.acceptKeyword && result.html.includes(page.acceptKeyword)));

    if (!isValid) {
      console.log(`[fail]  ${page.url} — ${result.reason ?? `too small (${result.html.length})`}`);
      failCount++;
      allOk = false;
    } else {
      mkdirSync(dirname(page.save), { recursive: true });
      writeFileSync(page.save, result.html, 'utf-8');
      console.log(`[ok]    ${page.save} (${result.html.length} bytes)${result.ok ? '' : ' [accepted 403 with keyword]'}`);
      successCount++;
    }

    await sleep(2500);
  }
  return allOk;
}

async function main() {
  const startTime = Date.now();

  console.log('=== Douban fixture fetcher ===\n');
  mkdirSync(join(fixturesDir, 'movie'), { recursive: true });
  mkdirSync(join(fixturesDir, 'book'), { recursive: true });
  mkdirSync(join(fixturesDir, 'user'), { recursive: true });

  // ── Phase 1: Non-user pages ────────────────────────────────────────────────

  const nonUserPages: Array<{ url: string; save: string; referer: string }> = [
    {
      // Use Chinese search term so result HTML contains Chinese characters directly
      // inception detail page (subject/3541415) requires browser-solved PoW — use search instead
      url: 'https://search.douban.com/movie/subject_search?search_text=%E7%9B%97%E6%A2%A6%E7%A9%BA%E9%97%B4&cat=1002',
      save: join(fixturesDir, 'movie', 'search-inception.html'),
      referer: 'https://movie.douban.com/',
    },
    {
      url: 'https://movie.douban.com/top250',
      save: join(fixturesDir, 'movie', 'top250.html'),
      referer: 'https://movie.douban.com/',
    },
    {
      url: 'https://book.douban.com/subject/2567698/',
      save: join(fixturesDir, 'book', 'three-body.html'),
      referer: 'https://book.douban.com/',
    },
    {
      url: 'https://search.douban.com/book/subject_search?search_text=%E4%B8%89%E4%BD%93',
      save: join(fixturesDir, 'book', 'search-three-body.html'),
      referer: 'https://book.douban.com/',
    },
  ];

  // NOTE: movie/inception.html (subject/3541415) requires a browser to solve Douban's
  // PoW challenge. It is fetched separately via Playwright and committed alongside
  // the other fixtures. The script fetches all other pages via Node fetch.
  // Check if inception.html already exists (pre-fetched via Playwright).
  let inceptionHtml = '';
  const inceptionPath = join(fixturesDir, 'movie', 'inception.html');
  try {
    const { readFileSync } = await import('fs');
    inceptionHtml = readFileSync(inceptionPath, 'utf-8');
    console.log(`[info]  Using pre-fetched inception.html (${inceptionHtml.length} bytes)`);
  } catch {
    console.log('[warn]  inception.html not found — it must be fetched via Playwright');
  }

  for (const page of nonUserPages) {
    const result = await fetchPage(page.url, page.referer);

    if (!result.ok || result.html.length < 5000) {
      const reason = !result.ok
        ? result.reason
        : `HTML too small (${result.html.length} bytes)`;
      console.log(`[fail]  ${page.url} — ${reason}`);
      failCount++;
    } else {
      mkdirSync(dirname(page.save), { recursive: true });
      writeFileSync(page.save, result.html, 'utf-8');
      console.log(`[ok]    ${page.save} (${result.html.length} bytes)`);
      successCount++;
    }

    await sleep(2500);
  }

  // Count inception.html as success if it already exists
  if (inceptionHtml.length > 5000) {
    successCount++;
    console.log(`[ok]    ${inceptionPath} (${inceptionHtml.length} bytes) [pre-fetched]`);
  } else {
    console.log('[fail]  movie/inception.html — must be fetched via Playwright (see README)');
    failCount++;
  }

  // ── Phase 2: Extract uid and fetch user pages ──────────────────────────────

  // Prefer inception.html for uid extraction; fall back to three-body.html
  let candidateUids = inceptionHtml ? extractUids(inceptionHtml) : [];

  // Fallback: try three-body.html which has /people/ links
  if (candidateUids.length === 0) {
    console.log('\n[info]  No uid in inception HTML, trying three-body.html...');
    try {
      const { readFileSync } = await import('fs');
      const threebody = readFileSync(join(fixturesDir, 'book', 'three-body.html'), 'utf-8');
      candidateUids = extractUids(threebody);
    } catch {
      // ignore
    }
  }

  // Last resort: fetch inception comments page
  if (candidateUids.length === 0) {
    console.log('\n[info]  Fetching inception comments page for uid...');
    await sleep(2500);
    const commentsResult = await fetchPage(
      'https://movie.douban.com/subject/3541415/comments?status=P',
      'https://movie.douban.com/subject/3541415/',
    );
    if (commentsResult.ok) {
      candidateUids = extractUids(commentsResult.html);
    }
  }

  if (candidateUids.length === 0) {
    console.log('[fail]  Could not extract any uid from Douban pages');
    failCount += 3; // 3 user pages all fail
  } else {
    console.log(`\n[info]  Candidate uids: ${candidateUids.slice(0, 5).join(', ')}`);
    let userPagesDone = false;
    const maxRetries = Math.min(3, candidateUids.length);

    for (let i = 0; i < maxRetries && !userPagesDone; i++) {
      const uid = candidateUids[i];
      console.log(`\n[info]  Trying uid: ${uid}`);
      userPagesDone = await fetchUserPages(uid);
      if (!userPagesDone && i < maxRetries - 1) {
        console.log(`[info]  uid ${uid} failed some pages, trying next uid in 5s...`);
        await sleep(5000);
      }
    }

    if (!userPagesDone) {
      console.log('[warn]  User pages may be partially fetched (private profile or deactivated)');
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Summary ===`);
  console.log(`Succeeded: ${successCount}`);
  console.log(`Failed:    ${failCount}`);
  console.log(`Elapsed:   ${elapsed}s`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
