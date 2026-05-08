import Bottleneck from 'bottleneck';
import { RateLimitError } from '../errors.js';

export interface LimiterConfig { readPerSec: number; writePerSec: number; cooldownSec: number; }

interface DomainState {
  readBucket: Bottleneck;
  writeBucket: Bottleneck;
  cooldownUntil: number;
  cooldownLevel: number;
  writeLocked: boolean;
}

export class DomainLimiter {
  private domains = new Map<string, DomainState>();
  constructor(private cfg: LimiterConfig) {}

  private get(domain: string): DomainState {
    let s = this.domains.get(domain);
    if (!s) {
      s = {
        readBucket: new Bottleneck({ minTime: Math.floor(1000 / this.cfg.readPerSec) }),
        writeBucket: new Bottleneck({ minTime: Math.floor(1000 / this.cfg.writePerSec) }),
        cooldownUntil: 0,
        cooldownLevel: 0,
        writeLocked: false,
      };
      this.domains.set(domain, s);
    }
    return s;
  }

  private guard(s: DomainState, kind: 'read' | 'write'): void {
    if (Date.now() < s.cooldownUntil) {
      throw new RateLimitError(`Domain in cooldown for ${Math.ceil((s.cooldownUntil - Date.now()) / 1000)}s`);
    }
    if (kind === 'write' && s.writeLocked) {
      throw new RateLimitError('Write operations locked for this session due to prior risk-control trigger');
    }
  }

  async acquireRead(domain: string): Promise<void> {
    const s = this.get(domain);
    this.guard(s, 'read');
    await s.readBucket.schedule(() => Promise.resolve());
  }

  async acquireWrite(domain: string): Promise<void> {
    const s = this.get(domain);
    this.guard(s, 'write');
    await s.writeBucket.schedule(() => Promise.resolve());
  }

  markCooldown(domain: string): void {
    const s = this.get(domain);
    s.cooldownLevel = Math.min(s.cooldownLevel + 1, 2);
    const seconds = s.cooldownLevel >= 2 ? Math.max(this.cfg.cooldownSec * 5, 300) : this.cfg.cooldownSec;
    s.cooldownUntil = Date.now() + seconds * 1000;
  }

  lockWriteForSession(domain: string): void { this.get(domain).writeLocked = true; }
}
