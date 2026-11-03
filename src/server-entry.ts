import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server as HttpServer } from 'http';

export interface ServeOpts { transport: 'stdio' | 'sse'; port: number; host: string; }

export const DEFAULT_SSE_HOST = '127.0.0.1';

function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

/**
 * `--host` > `DOUBAN_HOST` > 127.0.0.1. The SSE endpoint has no auth of its own
 * and proxies a (possibly logged-in) Douban session, so it must not listen on all
 * interfaces unless the operator asks for it explicitly.
 */
export function parseServeArgs(args: string[], env: NodeJS.ProcessEnv = process.env): ServeOpts {
  const transport = flagValue(args, '--transport') === 'sse' ? 'sse' : 'stdio';
  const port = parseInt(flagValue(args, '--port') ?? '', 10) || 3000;
  const host = flagValue(args, '--host') || env.DOUBAN_HOST || DEFAULT_SSE_HOST;
  return { transport, port, host };
}

/** Build (but do not listen on) the HTTP server that fronts the SSE transport. */
export async function createSseHttpServer(server: McpServer): Promise<HttpServer> {
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
  const http = await import('http');
  const transports = new Map<string, InstanceType<typeof SSEServerTransport>>();
  return http.createServer(async (req, res) => {
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
      logger.error(e, 'sse handler error');
      if (!res.headersSent) res.writeHead(500).end();
    }
  });
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
    const httpServer = await createSseHttpServer(server);
    httpServer.listen(opts.port, opts.host, () => {
      const shown = opts.host.includes(':') ? `[${opts.host}]` : opts.host;
      logger.info(`SSE listening on http://${shown}:${opts.port}/sse`);
      if (opts.host === '0.0.0.0' || opts.host === '::') {
        logger.warn('SSE endpoint is exposed on all interfaces and has no authentication; put it behind a firewall or reverse proxy.');
      }
    });
  } else {
    await server.connect(new StdioServerTransport());
    logger.info('douban-mcp listening on stdio');
  }
}
