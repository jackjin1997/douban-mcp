import { renderResult, renderError, exitCodeFor } from '../../../src/cli/output.js';
import {
  AuthError, NotFoundError, RateLimitError, WriteDisabledError, ParseError, NetworkError,
} from '../../../src/errors.js';

describe('renderResult', () => {
  it('human mode returns text as-is', () => {
    expect(renderResult({ ok: true, text: 'hello' }, false)).toBe('hello');
  });
  it('json mode prefers data, fallback to text', () => {
    expect(renderResult({ ok: true, text: 'hello', data: [1, 2] }, true)).toBe('[1,2]');
    expect(renderResult({ ok: true, text: 'hello' }, true)).toBe('"hello"');
  });
});

describe('renderError', () => {
  it('human mode renders friendly text from formatError', () => {
    expect(renderError(new AuthError('x'), false)).toContain('cookie 已失效');
  });
  it('json mode renders {"error":{"code","message"}}', () => {
    expect(JSON.parse(renderError(new AuthError('inner'), true))).toEqual({
      error: { code: 'AUTH_FAILED', message: 'inner' },
    });
  });
  it('non-DoubanError still renders something', () => {
    const obj = JSON.parse(renderError(new Error('boom'), true));
    expect(obj.error.code).toBe('UNKNOWN');
    expect(obj.error.message).toBe('boom');
  });
});

describe('exitCodeFor', () => {
  it.each([
    [new AuthError('x'), 1],
    [new WriteDisabledError('x'), 1],
    [new NotFoundError('x'), 2],
    [new RateLimitError('x'), 3],
    [new ParseError('x'), 4],
    [new NetworkError('x'), 4],
    [new Error('boom'), 4],
  ])('maps %s -> %s', (e: any, code) => {
    expect(exitCodeFor(e)).toBe(code);
  });
});
