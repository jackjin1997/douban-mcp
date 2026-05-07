import { withErrorBoundary, errorToCode } from '../../../src/tools/_boundary.js';
import {
  AuthError, RateLimitError, NotFoundError, WriteDisabledError,
  ParseError, NetworkError,
} from '../../../src/errors.js';

describe('withErrorBoundary', () => {
  it('wraps successful handler into MCP content shape', async () => {
    const wrapped = withErrorBoundary(async () => ({ markdown: 'hello', data: null }));
    const r = await wrapped({});
    expect(r.content[0]).toEqual({ type: 'text', text: 'hello' });
    expect(r.isError).toBeUndefined();
  });

  it.each([
    [AuthError, 'cookie 已失效'],
    [NotFoundError, '找不到对应资源'],
    [RateLimitError, '触发豆瓣访问限流'],
    [ParseError, '页面结构变化'],
    [WriteDisabledError, '写操作未启用'],
    [NetworkError, '网络错误'],
  ])('formats %s into a friendly markdown error', async (Cls: any, marker: string) => {
    const wrapped = withErrorBoundary(async (): Promise<never> => { throw new Cls('inner'); });
    const r = await wrapped({});
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toContain(marker);
  });

  it('falls back to "未知错误" for unrelated Error', async () => {
    const wrapped = withErrorBoundary(async (): Promise<never> => { throw new Error('boom'); });
    const r = await wrapped({});
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toContain('未知错误');
  });
});

describe('errorToCode', () => {
  it.each([
    [new AuthError('x'), 'AUTH_FAILED'],
    [new NotFoundError('x'), 'NOT_FOUND'],
    [new RateLimitError('x'), 'RATE_LIMITED'],
    [new ParseError('x'), 'PARSE_FAILED'],
    [new WriteDisabledError('x'), 'WRITE_DISABLED'],
    [new NetworkError('x'), 'NETWORK_ERROR'],
    [new Error('x'), 'UNKNOWN'],
  ])('maps %s', (e: any, code) => {
    expect(errorToCode(e)).toBe(code);
  });
});
