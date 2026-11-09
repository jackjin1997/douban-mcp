import { spawn } from 'child_process';
import { resolve } from 'path';
import { execSync } from 'child_process';

const CLI = resolve('dist/index.js');

beforeAll(() => {
  execSync('pnpm build', { stdio: 'inherit' });
}, 60_000);

describe('stdio MCP server e2e', () => {
  it('boots, responds to tools/list, lists search_movie', async () => {
    const child = spawn('node', [CLI, 'serve'], {
      env: { ...process.env, DOUBAN_DISABLE_CACHE: 'true' },
    });

    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { console.error('[stderr]', d.toString()); });

    // Write a tools/list JSON-RPC request
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n');

    // Wait for the response itself rather than a fixed sleep: cold start is
    // ~2-2.5s on a loaded laptop, so a fixed 2.5s window made this flaky.
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 15_000);
      child.stdout.on('data', () => {
        if (stdout.includes('"name":"search_movie"')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    child.kill('SIGTERM');
    await new Promise(r => child.on('close', r));

    expect(stdout).toContain('"name":"search_movie"');
  }, 30_000);
});
