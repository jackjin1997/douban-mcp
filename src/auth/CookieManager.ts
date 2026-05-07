export class CookieManager {
  constructor(private rawCookie: string | undefined) {}
  toHeader(): string { return this.rawCookie ?? ''; }
  hasLogin(): boolean { return Boolean(this.rawCookie && /dbcl2=/.test(this.rawCookie)); }
  getCkToken(): string | null {
    const m = this.rawCookie?.match(/(?:^|;\s*)ck=([^;]+)/);
    return m?.[1] ?? null;
  }
  getOwnUid(): string | null {
    const m = this.rawCookie?.match(/(?:^|;\s*)dbcl2="?(\d+):/);
    return m?.[1] ?? null;
  }
}
