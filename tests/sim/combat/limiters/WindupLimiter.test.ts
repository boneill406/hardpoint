import { describe, expect, it } from 'vitest';
import { WindupLimiter } from '../../../../src/sim/combat/limiters/WindupLimiter';

const TICK = 1 / 60;
const WINDUP = { kind: 'windup' as const, seconds: 0.3 };

/** Ticks of held trigger until it may fire (the first held tick is tick 0). */
function ticksUntilReady(limiter: WindupLimiter, held = (): boolean => true): number {
  for (let tick = 0; tick < 120; tick++) {
    limiter.update(TICK, held());
    if (limiter.canFire()) {
      return tick;
    }
  }
  return -1;
}

describe('WindupLimiter', () => {
  it('fires exactly 0.3 s (18 ticks) after the trigger is first held', () => {
    expect(ticksUntilReady(new WindupLimiter(WINDUP))).toBe(18);
  });

  it('releasing cancels: the next windup starts from zero', () => {
    const limiter = new WindupLimiter(WINDUP);
    for (let i = 0; i < 10; i++) limiter.update(TICK, true);
    limiter.update(TICK, false);
    expect(limiter.windingUp).toBe(false);
    expect(ticksUntilReady(limiter)).toBe(18);
  });

  it('each shot needs a fresh windup', () => {
    const limiter = new WindupLimiter(WINDUP);
    ticksUntilReady(limiter);
    limiter.onFired();
    expect(limiter.canFire()).toBe(false);
    expect(ticksUntilReady(limiter)).toBe(18);
  });

  it('reports progress for the telegraph', () => {
    const limiter = new WindupLimiter(WINDUP);
    for (let i = 0; i < 10; i++) limiter.update(TICK, true);
    const status = limiter.describe();
    expect(status.kind).toBe('windup');
    if (status.kind !== 'windup') return;
    expect(status.active).toBe(true);
    expect(status.progress).toBeCloseTo(9 / 18, 9);
  });
});
