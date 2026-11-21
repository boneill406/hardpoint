import { describe, expect, it } from 'vitest';
import type { WeaponDef } from '../../../src/sim/combat/WeaponDef';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { CANNON, INSURGENT_CANNON, MACHINE_GUN } from '../../../src/sim/defs/weapons';

function wholeTicks(seconds: number): boolean {
  const ticks = seconds / TICK_SECONDS;
  return Math.abs(ticks - Math.round(ticks)) < 1e-9;
}

// Invariants any tuning must keep (M3 plan D13), not the values themselves.
describe.each([CANNON, MACHINE_GUN, INSURGENT_CANNON])('$name def', (def: WeaponDef) => {
  it('has positive damage, speed and radius, and at least one limiter', () => {
    expect(def.damage).toBeGreaterThan(0);
    expect(def.projectile.speed).toBeGreaterThan(0);
    expect(def.projectile.radius).toBeGreaterThan(0);
    expect(def.limiters.length).toBeGreaterThan(0);
  });

  it('times every limiter in whole 60 Hz ticks (even cadence, exact lockouts)', () => {
    for (const limiter of def.limiters) {
      if (limiter.kind === 'reload') {
        expect(wholeTicks(limiter.seconds), `${def.name} reload`).toBe(true);
      } else {
        expect(Number.isInteger(limiter.roundsToOverheat)).toBe(true);
        expect(wholeTicks(1 / limiter.coolPerSecond), `${def.name} full cool`).toBe(true);
        expect(
          wholeTicks((1 - limiter.rearmAt) / limiter.coolPerSecond),
          `${def.name} lockout`,
        ).toBe(true);
      }
    }
  });
});
