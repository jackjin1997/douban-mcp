import { readFileSync } from 'fs';
import { resolve } from 'path';

const fixturesDir = resolve(process.cwd(), '__tests__', 'fixtures');

export function loadFixture(relativePath: string): string {
  return readFileSync(resolve(fixturesDir, relativePath), 'utf-8');
}
