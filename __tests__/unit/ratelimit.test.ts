import { DomainLimiter } from '../../src/ratelimit/Limiter.js';
import { RateLimitError } from '../../src/errors.js';

describe('DomainLimiter', () => {
  it('throws RateLimitError when domain in cooldown', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 1 });
    lim.markCooldown('movie.douban.com');
    await expect(lim.acquireRead('movie.douban.com')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('allows requests after cooldown expires', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 0.05 });
    lim.markCooldown('movie.douban.com');
    await new Promise(r => setTimeout(r, 80));
    await expect(lim.acquireRead('movie.douban.com')).resolves.toBeUndefined();
  });

  it('write session lock persists across cooldown', async () => {
    const lim = new DomainLimiter({ readPerSec: 10, writePerSec: 10, cooldownSec: 0.05 });
    lim.lockWriteForSession('movie.douban.com');
    await new Promise(r => setTimeout(r, 80));
    await expect(lim.acquireWrite('movie.douban.com')).rejects.toBeInstanceOf(RateLimitError);
  });
});
