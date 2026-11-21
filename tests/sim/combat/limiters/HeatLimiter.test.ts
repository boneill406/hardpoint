import { describe, expect, it } from 'vitest';
import { HeatLimiter } from '../../../../src/sim/combat/limiters/HeatLimiter';
import type { HeatLimiterDef } from '../../../../src/sim/combat/WeaponDef';
import { TICK_SECONDS } from '../../../../src/sim/core/time';

const DEF: HeatLimiterDef = {
  kind: 'heat',
  roundsToOverheat: 30,
  coolPerSecond: 0.25,
  rearmAt: 0.3,
};

function fire(limiter: HeatLimiter, shots: number): void {
  for (let i = 0; i < shots; i++) {
    limiter.onFired();
  }
}

function wait(limiter: HeatLimiter, seconds: number, triggerHeld: boolean): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    limiter.update(TICK_SECONDS, triggerHeld);
  }
}

describe('HeatLimiter', () => {
  it('blocks after exactly roundsToOverheat shots', () => {
    const limiter = new HeatLimiter(DEF);
    fire(limiter, 29);
    expect(limiter.canFire()).toBe(true);
    fire(limiter, 1);
    expect(limiter.canFire()).toBe(false);
    expect(limiter.describe()).toEqual({ kind: 'heat', heat: 1, overheated: true });
  });

  it('does not cool while the trigger is held and the weapon can fire', () => {
    const limiter = new HeatLimiter(DEF);
    fire(limiter, 15);
    wait(limiter, 2, true);
    expect(limiter.describe()).toEqual({
      kind: 'heat',
      heat: expect.closeTo(0.5, 9) as number,
      overheated: false,
    });
  });

  it('cools at its rate once the trigger is released', () => {
    const limiter = new HeatLimiter(DEF);
    fire(limiter, 15);
    wait(limiter, 1, false);
    const status = limiter.describe();
    expect(status.kind === 'heat' && status.heat).toBeCloseTo(0.25, 9);
  });

  it('re-arms at 30% heat: locked out 2.8 s after overheating, even with the trigger held', () => {
    const limiter = new HeatLimiter(DEF);
    fire(limiter, 30);
    wait(limiter, 2.8 - 1 / 60, true);
    expect(limiter.canFire()).toBe(false);
    wait(limiter, 1 / 60, true);
    expect(limiter.canFire()).toBe(true);
  });

  it('never cools below zero', () => {
    const limiter = new HeatLimiter(DEF);
    fire(limiter, 3);
    wait(limiter, 10, false);
    expect(limiter.snapshot()).toEqual({ heat: 0, overheated: 0 });
  });
});
