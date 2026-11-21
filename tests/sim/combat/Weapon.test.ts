import { describe, expect, it } from 'vitest';
import { Weapon } from '../../../src/sim/combat/Weapon';
import type { WeaponDef } from '../../../src/sim/combat/WeaponDef';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { CANNON, MACHINE_GUN } from '../../../src/sim/defs/weapons';

/** Holds (or releases) the trigger for `ticks`, the way the sim drives a weapon; returns the ticks it fired on. */
function hold(weapon: Weapon, ticks: number, triggerHeld = true): number[] {
  const fired: number[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    weapon.update(TICK_SECONDS, triggerHeld);
    if (triggerHeld && weapon.tryFire()) {
      fired.push(tick);
    }
  }
  return fired;
}

describe('Weapon', () => {
  it('fires only when every limiter allows: the MG needs both its cadence and its heat', () => {
    const weapon = new Weapon(MACHINE_GUN);
    expect(weapon.tryFire()).toBe(true);
    // Cadence blocks the very next tick even though heat would allow it.
    weapon.update(TICK_SECONDS, true);
    expect(weapon.canFire()).toBe(false);
  });

  it('the MG fires 12 rounds per second, exactly 5 ticks apart', () => {
    const fired = hold(new Weapon(MACHINE_GUN), 60);
    expect(fired).toHaveLength(12);
    expect(fired.slice(1).map((tick, i) => tick - (fired[i] ?? 0))).toEqual(Array(11).fill(5));
  });

  it('the MG fires exactly 30 rounds, then is locked out for 2.8 s (168 ticks), then fires again', () => {
    const fired = hold(new Weapon(MACHINE_GUN), 400);
    const firstThirty = Array.from({ length: 30 }, (_, i) => i * 5);
    expect(fired.slice(0, 30)).toEqual(firstThirty);
    // The 30th round (tick 145) overheats it; heat then blocks even though cadence would allow.
    expect(fired[30]).toBe(145 + 168);
  });

  it('holding the cannon trigger fires once per reload (1.5 s)', () => {
    const fired = hold(new Weapon(CANNON), 300);
    expect(fired).toEqual([0, 90, 180, 270]);
  });

  it('a released trigger never fires', () => {
    expect(hold(new Weapon(CANNON), 120, false)).toEqual([]);
  });

  it('refuses a def with no limiters', () => {
    const bare: WeaponDef = { ...CANNON, limiters: [] };
    expect(() => new Weapon(bare)).toThrow('at least one limiter');
  });
});
