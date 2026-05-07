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
