import { describe, expect, it } from 'vitest';
import { ReloadLimiter } from '../../../../src/sim/combat/limiters/ReloadLimiter';
import { TICK_SECONDS } from '../../../../src/sim/core/time';

/** Ticks until the limiter allows firing again, updating before each check (as the sim does). */
function ticksUntilReady(limiter: ReloadLimiter): number {
  let ticks = 0;
  do {
    limiter.update(TICK_SECONDS);
    ticks++;
  } while (!limiter.canFire());
  return ticks;
}

describe('ReloadLimiter', () => {
  it('is ready before the first shot', () => {
    expect(new ReloadLimiter({ kind: 'reload', seconds: 1.5 }).canFire()).toBe(true);
  });

  it('blocks for exactly the reload time in ticks (1.5 s = 90 ticks)', () => {
    const limiter = new ReloadLimiter({ kind: 'reload', seconds: 1.5 });
    limiter.onFired();
    expect(limiter.canFire()).toBe(false);
    expect(ticksUntilReady(limiter)).toBe(90);
  });

  it('reports reload progress from 0 (just fired) to 1 (ready)', () => {
    const limiter = new ReloadLimiter({ kind: 'reload', seconds: 1 });
    limiter.onFired();
    expect(limiter.describe()).toEqual({ kind: 'reload', progress: 0 });
    for (let i = 0; i < 30; i++) limiter.update(TICK_SECONDS);
    expect(limiter.describe()).toEqual({
      kind: 'reload',
      progress: expect.closeTo(0.5, 9) as number,
    });
  });
});
