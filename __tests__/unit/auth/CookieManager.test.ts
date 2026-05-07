import { CookieManager } from '../../../src/auth/CookieManager.js';

describe('CookieManager', () => {
  const cookie = 'bid=ABCDE; ll="108288"; dbcl2="12345:xyz"; ck=DEFG; ap_v=0';
  const mgr = new CookieManager(cookie);

  it('toHeader returns full cookie string when present', () => {
    expect(mgr.toHeader()).toBe(cookie);
  });

  it('toHeader returns empty string when undefined', () => {
    expect(new CookieManager(undefined).toHeader()).toBe('');
  });

  it('getOwnUid extracts numeric uid from dbcl2', () => {
    expect(mgr.getOwnUid()).toBe('12345');
  });

  it('getOwnUid returns null when no dbcl2', () => {
    expect(new CookieManager('bid=x').getOwnUid()).toBeNull();
  });

  it('getCkToken extracts ck value', () => {
    expect(mgr.getCkToken()).toBe('DEFG');
  });

  it('getCkToken returns null when no ck', () => {
    expect(new CookieManager('bid=x').getCkToken()).toBeNull();
  });

  it('hasLogin returns true when dbcl2 present', () => {
    expect(mgr.hasLogin()).toBe(true);
  });

  it('hasLogin returns false when no dbcl2', () => {
    expect(new CookieManager(undefined).hasLogin()).toBe(false);
    expect(new CookieManager('bid=x').hasLogin()).toBe(false);
  });
});
