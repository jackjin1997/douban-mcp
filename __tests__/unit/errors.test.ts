import {
  DoubanError, AuthError, NotFoundError, RateLimitError,
  ParseError, WriteDisabledError, NetworkError,
} from '../../src/errors.js';

describe('error hierarchy', () => {
  it.each([
    [AuthError, 'AUTH_FAILED'],
    [NotFoundError, 'NOT_FOUND'],
    [RateLimitError, 'RATE_LIMITED'],
    [ParseError, 'PARSE_FAILED'],
    [WriteDisabledError, 'WRITE_DISABLED'],
    [NetworkError, 'NETWORK_ERROR'],
  ])('%s carries code %s and is a DoubanError', (Cls: any, code) => {
    const e = new Cls('msg');
    expect(e).toBeInstanceOf(DoubanError);
    expect(e.code).toBe(code);
    expect(e.message).toBe('msg');
  });
});
