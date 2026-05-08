import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { buildToolRegistry } from '../src/tools/registry.js';
import type { IDoubanDataSource } from '../src/datasources/types.js';

const SKILL_PATH = resolve('skills/douban/SKILL.md');
const BEGIN = '<!-- BEGIN AUTO-COMMANDS -->';
const END = '<!-- END AUTO-COMMANDS -->';

// 轻量 stub：不依赖 jest，仅用于获取 registry 元数据
const noop = async (): Promise<any> => null;
const stubDataSource: IDoubanDataSource = {
  getCurrentUser: noop,
  searchMovie: noop,
  getMovie: noop,
  getMovieReviews: noop,
  getMovieChart: noop,
  searchBook: noop,
  getBook: noop,
  getBookReviews: noop,
  getBookChart: noop,
  getUserCollections: noop,
  getUserDoulist: noop,
  getUserProfile: noop,
  markSubject: noop,
  unmarkSubject: noop,
};

const registry = buildToolRegistry({
  dataSource: stubDataSource,
  cookie: 'bid=x; dbcl2="1:y"',
  enableWrite: true,
});

const lines: string[] = ['', '| 命令 | 说明 |', '|---|---|'];
for (const t of registry) {
  const desc = t.description.replace(/\n/g, ' ').replace(/\|/g, '\\|');
  lines.push(`| \`${t.cliName}\` | ${desc} |`);
}
lines.push('');

const md = readFileSync(SKILL_PATH, 'utf-8');
const beginIdx = md.indexOf(BEGIN);
const endIdx = md.indexOf(END);
if (beginIdx === -1 || endIdx === -1) {
  throw new Error(`SKILL.md missing AUTO-COMMANDS markers`);
}
const before = md.slice(0, beginIdx + BEGIN.length);
const after = md.slice(endIdx);
const out = `${before}\n${lines.join('\n')}\n${after}`;
writeFileSync(SKILL_PATH, out);
console.log(`Updated ${SKILL_PATH} with ${registry.length} commands`);
