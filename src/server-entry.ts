import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server as HttpServer, IncomingMessage } from 'http';

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

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * When the server is bound to a loopback address, only accept requests whose
 * Host / Origin headers name that loopback endpoint. This blocks DNS rebinding:
 * a web page the user visits cannot resolve its own domain to 127.0.0.1 and
 * then talk to this server through the browser. Returns `undefined` when the
 * operator bound a non-loopback host, since legitimate Host values are then
 * unknowable (and they were already warned about exposure).
 */
export function sseTransportOptions(address: string, port: number): {
  enableDnsRebindingProtection: boolean; allowedHosts: string[]; allowedOrigins: string[];
} | undefined {
  if (!LOOPBACK_ADDRESSES.has(address)) return undefined;
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  return {
    enableDnsRebindingProtection: true,
    allowedHosts: hosts,
    allowedOrigins: hosts.map(h => `http://${h}`),
  };
}

type SseOptions = NonNullable<ReturnType<typeof sseTransportOptions>>;

/**
 * Mirror of the SDK's Host/Origin check. SSEServerTransport only runs it inside
 * handlePostMessage (POST /messages); the GET /sse handshake goes through
 * start(), which never sees the request, so we have to guard it ourselves.
 */
function rejectedHeader(req: IncomingMessage, options: SseOptions | undefined): string | undefined {
  if (!options?.enableDnsRebindingProtection) return undefined;
  const host = req.headers.host;
  if (!host || !options.allowedHosts.includes(host)) return `Invalid Host header: ${host}`;
  const origin = req.headers.origin;
  if (origin && !options.allowedOrigins.includes(origin)) return `Invalid Origin header: ${origin}`;
  return undefined;
}

/** Build (but do not listen on) the HTTP server that fronts the SSE transport. */
export async function createSseHttpServer(server: McpServer): Promise<HttpServer> {
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
  const http = await import('http');
  const transports = new Map<string, InstanceType<typeof SSEServerTransport>>();
  const httpServer: HttpServer = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/sse') {
        const bound = httpServer.address();
        const options = bound && typeof bound === 'object' ? sseTransportOptions(bound.address, bound.port) : undefined;
        const rejected = rejectedHeader(req, options);
        if (rejected) {
          logger.warn(`rejected SSE handshake: ${rejected}`);
          res.writeHead(403).end(rejected);
          return;
        }
        const transport = new SSEServerTransport('/messages', res, options);
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
  return httpServer;
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
