#!/usr/bin/env node
import 'dotenv/config';
import { DoubanError } from './errors.js';
import { formatError } from './tools/_boundary.js';

async function main() {
  const arg = process.argv[2];
  if (arg === undefined || arg === 'serve') {
    const { runServe } = await import('./server-entry.js');
    return runServe(process.argv.slice(arg === 'serve' ? 3 : 2));
  }
  const { runCli } = await import('./cli.js');
  return runCli(process.argv.slice(2));
}

main().catch(err => {
  if (err instanceof DoubanError) {
    console.error(formatError(err));
    process.exit(1);
  }
  console.error('fatal', err);
  process.exit(1);
});
