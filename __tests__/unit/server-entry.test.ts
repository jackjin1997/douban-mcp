import { parseServeArgs, createSseHttpServer } from '../../src/server-entry.js';
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

describe('createSseHttpServer', () => {
  let httpServer: http.Server;
  afterEach(async () => {
    if (httpServer?.listening) await new Promise<void>(r => httpServer.close(() => r()));
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
