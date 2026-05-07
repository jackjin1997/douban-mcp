import { createLogger, redactCookie } from '../../src/utils/logger.js';

describe('redactCookie', () => {
  it('masks dbcl2/bid/ck values inside cookie strings', () => {
    const raw = 'bid=ABC; dbcl2="123:xyz"; ck=DEF; ll="108288"';
    expect(redactCookie(raw)).toBe('bid=***; dbcl2="***"; ck=***; ll="108288"');
  });

  it('returns original string when no cookie keys present', () => {
    expect(redactCookie('hello world')).toBe('hello world');
  });
});

describe('createLogger', () => {
  it('returns an object with info/warn/error/debug', () => {
    const log = createLogger();
    for (const m of ['info', 'warn', 'error', 'debug']) {
      expect(typeof (log as any)[m]).toBe('function');
    }
  });
});

describe('createLogger redaction', () => {
  it('redacts Cookie header in serialized error', () => {
    const chunks: string[] = [];
    const memStream: any = {
      write(chunk: unknown) {
        chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
        return true;
      },
      flush() {},
      end() {},
    };

    const log = createLogger(memStream);
    const err: any = new Error('mock 401');
    err.config = { headers: { Cookie: 'dbcl2="42:secret"; ck=SECRET' } };
    log.error(err, 'request failed');

    const out = chunks.join('');
    expect(out).not.toContain('SECRET');
    expect(out).not.toContain('dbcl2="42:');
    expect(out).toMatch(/REDACTED|\*\*\*/);
  });
});
