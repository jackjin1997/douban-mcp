export class DoubanError extends Error {
  code: string = 'DOUBAN_ERROR';
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class AuthError extends DoubanError      { code = 'AUTH_FAILED' as const; }
export class NotFoundError extends DoubanError  { code = 'NOT_FOUND' as const; }
export class RateLimitError extends DoubanError { code = 'RATE_LIMITED' as const; }
export class ParseError extends DoubanError     { code = 'PARSE_FAILED' as const; }
export class WriteDisabledError extends DoubanError { code = 'WRITE_DISABLED' as const; }
export class NetworkError extends DoubanError   { code = 'NETWORK_ERROR' as const; }
