import { parseServeArgs, createSseHttpServer, sseTransportOptions } from '../../src/server-entry.js';
import { buildServer } from '../../src/server.js';
import { FakeDataSource } from '../helpers/FakeDataSource.js';
import type { AddressInfo } from 'net';
import http from 'http';

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

  it('honours --host and --port flags', () => {
    delete process.env.DOUBAN_HOST;
    expect(parseServeArgs(['--transport', 'sse', '--port', '4100', '--host', '0.0.0.0']))
      .toEqual({ transport: 'sse', port: 4100, host: '0.0.0.0' });
  });

  it('falls back to DOUBAN_HOST when --host is absent', () => {
    process.env.DOUBAN_HOST = '::1';
    expect(parseServeArgs(['--transport', 'sse']).host).toBe('::1');
  });

  it('--host wins over DOUBAN_HOST', () => {
    process.env.DOUBAN_HOST = '0.0.0.0';
    expect(parseServeArgs(['--host', '127.0.0.1']).host).toBe('127.0.0.1');
  });
});

describe('sseTransportOptions', () => {
  it('enables DNS rebinding protection for loopback binds', () => {
    const o = sseTransportOptions('127.0.0.1', 3000);
    expect(o?.enableDnsRebindingProtection).toBe(true);
    expect(o?.allowedHosts).toEqual(['127.0.0.1:3000', 'localhost:3000', '[::1]:3000']);
    expect(sseTransportOptions('::1', 3000)?.enableDnsRebindingProtection).toBe(true);
  });

  it('leaves validation off for non-loopback binds', () => {
    expect(sseTransportOptions('0.0.0.0', 3000)).toBeUndefined();
    expect(sseTransportOptions('192.168.1.5', 3000)).toBeUndefined();
  });
});

describe('createSseHttpServer', () => {
  let httpServer: http.Server;
  afterEach(async () => {
    if (httpServer?.listening) {
      httpServer.closeAllConnections();
      await new Promise<void>(r => httpServer.close(() => r()));
    }
  });

  it('binds to the requested host and serves /sse as an event stream', async () => {
    const mcp = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    httpServer = await createSseHttpServer(mcp);
    await new Promise<void>(r => httpServer.listen(0, '127.0.0.1', () => r()));
    const addr = httpServer.address() as AddressInfo;
    expect(addr.address).toBe('127.0.0.1');

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: addr.port, path: '/sse' }, resolve).on('error', reject);
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    res.destroy();
  });

  async function get(port: number, path: string, headers: Record<string, string>) {
    return new Promise<http.IncomingMessage>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path, headers }, resolve).on('error', reject);
    });
  }

  it('rejects /sse when the Host header is not a loopback host (DNS rebinding)', async () => {
    const mcp = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    httpServer = await createSseHttpServer(mcp);
    await new Promise<void>(r => httpServer.listen(0, '127.0.0.1', () => r()));
    const { port } = httpServer.address() as AddressInfo;

    const evil = await get(port, '/sse', { Host: 'evil.example' });
    expect(evil.statusCode).toBe(403);
    evil.resume();

    const spoofedPort = await get(port, '/sse', { Host: `127.0.0.1:${port + 1}` });
    expect(spoofedPort.statusCode).toBe(403);
    spoofedPort.resume();

    const ok = await get(port, '/sse', { Host: `localhost:${port}` });
    expect(ok.statusCode).toBe(200);
    ok.destroy();
  });

  it('rejects /sse when Origin is a foreign site', async () => {
    const mcp = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    httpServer = await createSseHttpServer(mcp);
    await new Promise<void>(r => httpServer.listen(0, '127.0.0.1', () => r()));
    const { port } = httpServer.address() as AddressInfo;
    const res = await get(port, '/sse', { Host: `127.0.0.1:${port}`, Origin: 'https://evil.example' });
    expect(res.statusCode).toBe(403);
    res.resume();
  });

  it('returns 404 for unknown session on /messages', async () => {
    const mcp = buildServer({ dataSource: new FakeDataSource(), cookie: undefined, enableWrite: false });
    httpServer = await createSseHttpServer(mcp);
    await new Promise<void>(r => httpServer.listen(0, '127.0.0.1', () => r()));
    const { port } = httpServer.address() as AddressInfo;
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/messages?sessionId=nope', method: 'POST' }, r => {
        r.resume();
        resolve(r.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end('{}');
    });
    expect(status).toBe(404);
  });
});
