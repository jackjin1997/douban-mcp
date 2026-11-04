import { parseServeArgs, createMcpHttpServer, httpTransportOptions } from '../../src/server-entry.js';
import { buildServer } from '../../src/server.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AddressInfo } from 'net';
import http from 'http';

const newMcp = () => buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });

describe('parseServeArgs', () => {
  const saved = process.env.DOUBAN_HOST;
  afterEach(() => {
    if (saved === undefined) delete process.env.DOUBAN_HOST;
    else process.env.DOUBAN_HOST = saved;
  });

  it('defaults to stdio, port 3000 and loopback host', () => {
    delete process.env.DOUBAN_HOST;
    expect(parseServeArgs([])).toEqual({ transport: 'stdio', port: 3000, host: '127.0.0.1' });
  });

  it('accepts --transport http (Streamable HTTP) with --host and --port', () => {
    delete process.env.DOUBAN_HOST;
    expect(parseServeArgs(['--transport', 'http', '--port', '4100', '--host', '0.0.0.0']))
      .toEqual({ transport: 'http', port: 4100, host: '0.0.0.0' });
  });

  it('still accepts the legacy --transport sse value', () => {
    delete process.env.DOUBAN_HOST;
    expect(parseServeArgs(['--transport', 'sse']).transport).toBe('sse');
  });

  it('treats unknown transport values as stdio', () => {
    expect(parseServeArgs(['--transport', 'websocket']).transport).toBe('stdio');
  });

  it('falls back to DOUBAN_HOST when --host is absent', () => {
    process.env.DOUBAN_HOST = '::1';
    expect(parseServeArgs(['--transport', 'http']).host).toBe('::1');
  });

  it('--host wins over DOUBAN_HOST', () => {
    process.env.DOUBAN_HOST = '0.0.0.0';
    expect(parseServeArgs(['--host', '127.0.0.1']).host).toBe('127.0.0.1');
  });
});

describe('httpTransportOptions', () => {
  it('enables DNS rebinding protection for loopback binds', () => {
    const o = httpTransportOptions('127.0.0.1', 3000);
    expect(o?.enableDnsRebindingProtection).toBe(true);
    expect(o?.allowedHosts).toEqual(['127.0.0.1:3000', 'localhost:3000', '[::1]:3000']);
    expect(httpTransportOptions('::1', 3000)?.enableDnsRebindingProtection).toBe(true);
  });

  it('leaves validation off for non-loopback binds', () => {
    expect(httpTransportOptions('0.0.0.0', 3000)).toBeUndefined();
    expect(httpTransportOptions('192.168.1.5', 3000)).toBeUndefined();
  });
});

describe('createMcpHttpServer', () => {
  let httpServer: http.Server;
  let port: number;
  const clients: Client[] = [];

  beforeEach(async () => {
    httpServer = await createMcpHttpServer(newMcp);
    await new Promise<void>(r => httpServer.listen(0, '127.0.0.1', () => r()));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map(c => c.close().catch(() => undefined)));
    if (httpServer?.listening) {
      httpServer.closeAllConnections();
      await new Promise<void>(r => httpServer.close(() => r()));
    }
  });

  async function connect(): Promise<Client> {
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    clients.push(client);
    return client;
  }

  function request(opts: { method: string; path: string; headers?: Record<string, string>; body?: string }) {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: opts.path, method: opts.method, headers: opts.headers }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end(opts.body);
    });
  }

  describe('/mcp (Streamable HTTP)', () => {
    it('completes the initialize handshake and lists the douban tools', async () => {
      const client = await connect();
      expect(client.getServerVersion()?.name).toBe('douban-mcp');
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(expect.arrayContaining(['search_movie', 'get_movie']));
    });

    it('routes a tool call through the per-session server', async () => {
      const client = await connect();
      const result = await client.callTool({ name: 'get_movie', arguments: { id: '3541415' } });
      const text = (result.content as Array<{ type: string; text?: string }>).map(c => c.text ?? '').join('\n');
      expect(text).toContain('3541415');
    });

    it('serves two concurrent sessions, each with its own server instance', async () => {
      const a = await connect();
      const b = await connect();
      const [ta, tb] = await Promise.all([a.listTools(), b.listTools()]);
      expect(ta.tools.length).toBeGreaterThan(0);
      expect(tb.tools.length).toBe(ta.tools.length);
    });

    it('rejects a non-initialize POST without a session id with 400', async () => {
      const res = await request({
        method: 'POST', path: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: `127.0.0.1:${port}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown Mcp-Session-Id', async () => {
      const res = await request({
        method: 'POST', path: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: `127.0.0.1:${port}`, 'mcp-session-id': 'nope' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(res.status).toBe(404);
    });

    it('rejects a foreign Host header (DNS rebinding) before touching the transport', async () => {
      const res = await request({
        method: 'POST', path: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: 'evil.example' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '0' } } }),
      });
      expect(res.status).toBe(403);
    });

    it('rejects a foreign Origin header', async () => {
      const res = await request({
        method: 'POST', path: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: `127.0.0.1:${port}`, origin: 'https://evil.example' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '0' } } }),
      });
      expect(res.status).toBe(403);
    });

    it('DELETE /mcp ends the session so the id is no longer accepted', async () => {
      const client = await connect();
      const transport = client.transport as StreamableHTTPClientTransport;
      const sessionId = transport.sessionId!;
      expect(sessionId).toBeTruthy();
      await transport.terminateSession();  // sends DELETE /mcp; close() alone only drops the connection
      await client.close();
      clients.pop();
      const res = await request({
        method: 'POST', path: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: `127.0.0.1:${port}`, 'mcp-session-id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('legacy /sse', () => {
    function get(path: string, headers: Record<string, string>) {
      return new Promise<http.IncomingMessage>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path, headers }, resolve).on('error', reject);
      });
    }

    it('still serves /sse as an event stream', async () => {
      const res = await get('/sse', { host: `127.0.0.1:${port}` });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      res.destroy();
    });

    it('accepts a second concurrent SSE client (one server instance per connection)', async () => {
      const first = await get('/sse', { host: `127.0.0.1:${port}` });
      const second = await get('/sse', { host: `127.0.0.1:${port}` });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      first.destroy();
      second.destroy();
    });

    it('rejects /sse when the Host header is not a loopback host', async () => {
      const evil = await get('/sse', { Host: 'evil.example' });
      expect(evil.statusCode).toBe(403);
      evil.resume();
      const spoofedPort = await get('/sse', { Host: `127.0.0.1:${port + 1}` });
      expect(spoofedPort.statusCode).toBe(403);
      spoofedPort.resume();
      const ok = await get('/sse', { Host: `localhost:${port}` });
      expect(ok.statusCode).toBe(200);
      ok.destroy();
    });

    it('rejects /sse when Origin is a foreign site', async () => {
      const res = await get('/sse', { Host: `127.0.0.1:${port}`, Origin: 'https://evil.example' });
      expect(res.statusCode).toBe(403);
      res.resume();
    });

    it('returns 404 for unknown session on /messages', async () => {
      const res = await request({ method: 'POST', path: '/messages?sessionId=nope', headers: { host: `127.0.0.1:${port}` }, body: '{}' });
      expect(res.status).toBe(404);
    });
  });

  it('returns 404 for unrelated paths', async () => {
    const res = await request({ method: 'GET', path: '/nope', headers: { host: `127.0.0.1:${port}` } });
    expect(res.status).toBe(404);
  });
});
