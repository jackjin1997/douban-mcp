import { renderResult, renderError, exitCodeFor } from '../../../src/cli/output.js';
import type { ToolResult } from '../../../src/tools/registry.js';
import {
  AuthError, NotFoundError, RateLimitError, WriteDisabledError, ParseError, NetworkError,
} from '../../../src/errors.js';

describe('renderResult', () => {
  it('human mode returns markdown', () => {
    const r: ToolResult = { markdown: 'hello', data: null };
    expect(renderResult(r, false)).toBe('hello');
  });
  it('json mode returns JSON-stringified data', () => {
    const r: ToolResult = { markdown: 'human friendly', data: [1, 2, 3] };
    expect(renderResult(r, true)).toBe('[1,2,3]');
  });
  it('json mode with null data returns "null"', () => {
    const r: ToolResult = { markdown: 'x', data: null };
    expect(renderResult(r, true)).toBe('null');
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
