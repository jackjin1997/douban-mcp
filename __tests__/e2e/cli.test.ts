import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { execSync } from 'child_process';

const CLI = resolve('dist/index.js');

beforeAll(() => {
  // 确保最新 build
  execSync('pnpm build', { stdio: 'inherit' });
}, 60_000);

function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('CLI e2e', () => {
  it('list-tools exits 0 and prints multiple tool names', () => {
    const { stdout, status } = run(['list-tools'], { DOUBAN_DISABLE_CACHE: 'true' });
    expect(status).toBe(0);
    const lines = stdout.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.some(l => l.startsWith('search-movie'))).toBe(true);
  });

  it('list-tools --json returns parseable JSON array', () => {
    const { stdout, status } = run(['--json', 'list-tools']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(10);
    expect(parsed[0]).toHaveProperty('name');
    expect(parsed[0]).toHaveProperty('readOnly');
  });

  it('mark-movie not registered without cookie+enableWrite (commander unknown command exit nonzero)', () => {
    const result = run(['mark-movie', '--id', '1', '--status', 'collect'], {
      DOUBAN_COOKIE: '',
      DOUBAN_ENABLE_WRITE: 'false',
    });
    expect(result.status).not.toBe(0);
  });

  it('describe search-movie prints schema JSON', () => {
    const { stdout, status } = run(['describe', 'search-movie']);
    expect(status).toBe(0);
    const obj = JSON.parse(stdout);
    expect(obj.name).toBe('search-movie');
    expect(obj.mcpName).toBe('search_movie');
  });

  it('doctor exits 0 in anonymous mode', () => {
    const { stdout, status } = run(['doctor'], {
      DOUBAN_COOKIE: '',
      DOUBAN_ENABLE_WRITE: 'false',
    });
    expect(status).toBe(0);
    const obj = JSON.parse(stdout);
    expect(obj.ok).toBe(true);
  });
});
