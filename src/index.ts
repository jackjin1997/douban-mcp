#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
