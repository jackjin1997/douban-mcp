import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';

interface ServeOpts { transport: 'stdio' | 'sse'; port: number; }

function parseServeArgs(args: string[]): ServeOpts {
  const transport = (args[args.indexOf('--transport') + 1] === 'sse') ? 'sse' : 'stdio';
  const portIdx = args.indexOf('--port');
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1] ?? '', 10) || 3000 : 3000;
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
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    const http = await import('http');
    const transports = new Map<string, InstanceType<typeof SSEServerTransport>>();
    const httpServer = http.createServer(async (req, res) => {
      try {
        if (req.method === 'GET' && req.url === '/sse') {
          const transport = new SSEServerTransport('/messages', res);
          transports.set(transport.sessionId, transport);
          res.on('close', () => transports.delete(transport.sessionId));
          await server.connect(transport);
          return;
        }
        if (req.method === 'POST' && req.url?.startsWith('/messages')) {
          const url = new URL(req.url, 'http://x');
          const sessionId = url.searchParams.get('sessionId') ?? '';
          const transport = transports.get(sessionId);
          if (!transport) {
            res.writeHead(404).end('session not found');
            return;
          }
          await transport.handlePostMessage(req, res);
          return;
        }
        res.writeHead(404).end();
      } catch (e) {
        logger.error('sse handler error', e);
        if (!res.headersSent) res.writeHead(500).end();
      }
    });
    httpServer.listen(opts.port, () => logger.info(`SSE listening on http://localhost:${opts.port}/sse`));
  } else {
    await server.connect(new StdioServerTransport());
    logger.info('douban-mcp listening on stdio');
  }
}
