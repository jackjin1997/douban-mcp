import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixture(relativePath: string): string {
  return readFileSync(join(here, '..', 'fixtures', relativePath), 'utf-8');
}
