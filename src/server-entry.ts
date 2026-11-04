import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { createDataSource } from './datasources/factory.js';
import { logger } from './utils/logger.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';

/** `http` is Streamable HTTP (`/mcp`); `sse` is the deprecated 2024-11-05 transport, kept as an alias. */
export interface ServeOpts { transport: 'stdio' | 'http' | 'sse'; port: number; host: string; }

export const DEFAULT_HTTP_HOST = '127.0.0.1';

function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

/**
 * `--host` > `DOUBAN_HOST` > 127.0.0.1. The HTTP endpoints have no auth of their
 * own and proxy a (possibly logged-in) Douban session, so they must not listen on
 * all interfaces unless the operator asks for it explicitly.
 */
export function parseServeArgs(args: string[], env: NodeJS.ProcessEnv = process.env): ServeOpts {
  const raw = flagValue(args, '--transport');
  const transport = raw === 'http' || raw === 'sse' ? raw : 'stdio';
  const port = parseInt(flagValue(args, '--port') ?? '', 10) || 3000;
  const host = flagValue(args, '--host') || env.DOUBAN_HOST || DEFAULT_HTTP_HOST;
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
export function httpTransportOptions(address: string, port: number): {
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

type GuardOptions = NonNullable<ReturnType<typeof httpTransportOptions>>;

/**
 * Same Host/Origin check the SDK runs inside the Streamable HTTP transport,
 * applied once at the door for every route. The legacy SSE transport only
 * validates on POST /messages, so GET /sse would otherwise be unguarded, and
 * doing it here also keeps the 403 shape identical across endpoints.
 */
function rejectedHeader(req: IncomingMessage, options: GuardOptions | undefined): string | undefined {
  if (!options?.enableDnsRebindingProtection) return undefined;
  const host = req.headers.host;
  if (!host || !options.allowedHosts.includes(host)) return `Invalid Host header: ${host}`;
  const origin = req.headers.origin;
  if (origin && !options.allowedOrigins.includes(origin)) return `Invalid Origin header: ${origin}`;
  return undefined;
}

const MAX_BODY_BYTES = 1024 * 1024;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve(undefined);
      try { resolve(JSON.parse(text)); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function jsonError(res: ServerResponse, status: number, code: number, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

/**
 * Build (but do not listen on) the HTTP server that fronts the MCP transports.
 *
 * - `/mcp`            Streamable HTTP (2025-03-26+), stateful: one McpServer per
 *                      `Mcp-Session-Id`, created on the `initialize` POST.
 * - `/sse`, `/messages` Legacy HTTP+SSE (2024-11-05), one McpServer per stream.
 *
 * `newServer` is called per session because an McpServer owns exactly one
 * transport: the SDK throws "Already connected" on a second connect(), which
 * is what used to make a second concurrent SSE client fail with 500.
 */
export async function createMcpHttpServer(newServer: () => McpServer): Promise<HttpServer> {
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
  const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
  const { randomUUID } = await import('crypto');
  const http = await import('http');

  const streamable = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();
  const legacy = new Map<string, InstanceType<typeof SSEServerTransport>>();

  const httpServer: HttpServer = http.createServer(async (req, res) => {
    try {
      const bound = httpServer.address();
      const options = bound && typeof bound === 'object' ? httpTransportOptions(bound.address, bound.port) : undefined;
      const rejected = rejectedHeader(req, options);
      if (rejected) {
        logger.warn(`rejected ${req.method} ${req.url}: ${rejected}`);
        res.writeHead(403).end(rejected);
        return;
      }
      const path = new URL(req.url ?? '/', 'http://x').pathname;

      if (path === '/mcp') {
        const sessionId = req.headers['mcp-session-id'];
        if (typeof sessionId === 'string') {
          const transport = streamable.get(sessionId);
          if (!transport) return jsonError(res, 404, -32001, 'Session not found');
          await transport.handleRequest(req, res);
          return;
        }
        if (req.method !== 'POST') return jsonError(res, 400, -32000, 'Bad Request: Mcp-Session-Id header is required');
        const body = await readJsonBody(req).catch(e => e as Error);
        if (body instanceof Error) return jsonError(res, 400, -32700, `Parse error: ${body.message}`);
        const isInit = Array.isArray(body) ? body.some(isInitializeRequest) : isInitializeRequest(body);
        if (!isInit) return jsonError(res, 400, -32000, 'Bad Request: Mcp-Session-Id header is required');

        const transport = new StreamableHTTPServerTransport({
          ...options,
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: id => { streamable.set(id, transport); },
          onsessionclosed: id => { streamable.delete(id); },
        });
        transport.onclose = () => { if (transport.sessionId) streamable.delete(transport.sessionId); };
        await newServer().connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === 'GET' && path === '/sse') {
        logger.warn('legacy SSE client connected on /sse; this transport is deprecated, point the client at /mcp');
        const transport = new SSEServerTransport('/messages', res, options);
        legacy.set(transport.sessionId, transport);
        res.on('close', () => legacy.delete(transport.sessionId));
        await newServer().connect(transport);
        return;
      }
      if (req.method === 'POST' && path === '/messages') {
        const sessionId = new URL(req.url ?? '/', 'http://x').searchParams.get('sessionId') ?? '';
        const transport = legacy.get(sessionId);
        if (!transport) {
          res.writeHead(404).end('session not found');
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }
      res.writeHead(404).end();
    } catch (e) {
      logger.error(e, 'mcp http handler error');
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
  // Data source, cache and rate limiter are shared; only the protocol layer is per session.
  const newServer = () => buildServer({ dataSource, cookie, enableWrite });

  const opts = parseServeArgs(args);
  if (opts.transport === 'stdio') {
    await newServer().connect(new StdioServerTransport());
    logger.info('douban-mcp listening on stdio');
    return;
  }
  if (opts.transport === 'sse') {
    logger.warn('--transport sse is deprecated; it now starts the same HTTP server as --transport http. Point clients at /mcp.');
  }
  const httpServer = await createMcpHttpServer(newServer);
  httpServer.listen(opts.port, opts.host, () => {
    const shown = opts.host.includes(':') ? `[${opts.host}]` : opts.host;
    logger.info(`MCP Streamable HTTP listening on http://${shown}:${opts.port}/mcp (legacy SSE: /sse)`);
    if (opts.host === '0.0.0.0' || opts.host === '::') {
      logger.warn('HTTP endpoints are exposed on all interfaces and have no authentication; put them behind a firewall or reverse proxy.');
    }
  });
}
