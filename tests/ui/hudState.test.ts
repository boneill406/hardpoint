import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../src/sim/core/Vec2';
import { ScriptedController } from '../../src/sim/debug/ScriptedController';
import { CANNON } from '../../src/sim/defs/weapons';
import { PLAYER_TANK } from '../../src/sim/defs/vehicles';
import { IDLE_COMMAND } from '../../src/sim/vehicles/VehicleCommand';
import type { Vehicle } from '../../src/sim/vehicles/Vehicle';
import { createVehicle } from '../../src/sim/vehicles/VehicleFactory';
import { hudState } from '../../src/ui/hudState';

function playerTank(): Vehicle {
  return createVehicle(PLAYER_TANK, {
    transform: { position: Vec2.ZERO, heading: 0 },
    faction: 'player',
    controller: new ScriptedController(() => IDLE_COMMAND),
  });
}

const TICK = 1 / 60;

describe('hudState', () => {
  it('a fresh tank: full armor, cannon ready, MG cold, with the re-arm marker at 30%', () => {
    const state = hudState(playerTank());
    expect(state.armor).toEqual({ current: 100, max: 100, fraction: 1, critical: false });
    expect(state.weapons).toEqual([
      { kind: 'reload', name: 'Cannon', slot: 'primary', progress: 1, ready: true },
      {
        kind: 'heat',
        name: 'Machine gun',
        slot: 'secondary',
        heat: 0,
        overheated: false,
        rearmAt: 0.3,
      },
    ]);
  });

  it('armor at or below 30% is critical (the bar pulses, GDD §7)', () => {
    const tank = playerTank();
    tank.health.damage(69);
    expect(hudState(tank).armor.critical).toBe(false);
    tank.health.damage(1);
    expect(hudState(tank).armor).toMatchObject({ current: 30, fraction: 0.3, critical: true });
  });

  it('the cannon bar empties on firing and refills over the reload', () => {
    const tank = playerTank();
    const [cannon] = tank.mounts;
    if (cannon === undefined) throw new Error('setup');
    cannon.weapon.update(TICK, true);
    expect(cannon.weapon.tryFire()).toBe(true);
    expect(hudState(tank).weapons[0]).toMatchObject({ progress: 0, ready: false });
    const half = CANNON.limiters[0]?.kind === 'reload' ? CANNON.limiters[0].seconds / 2 : 0;
    for (let t = 0; t < half - 1e-9; t += TICK) {
      cannon.weapon.update(TICK, false);
    }
    const gauge = hudState(tank).weapons[0];
    expect(gauge?.kind === 'reload' ? gauge.progress : -1).toBeCloseTo(0.5, 1);
  });

  it('the MG bar shows heat and the overheated state', () => {
    const tank = playerTank();
    const mg = tank.mounts[1];
    if (mg === undefined) throw new Error('setup');
    // Trigger held 2.6 s: 30 rounds (one per 5 ticks) overheat it at 2.5 s; it has cooled a little since.
    for (let i = 0; i < 156; i++) {
      mg.weapon.update(TICK, true);
      mg.weapon.tryFire();
    }
    const gauge = hudState(tank).weapons[1];
    expect(gauge).toMatchObject({ kind: 'heat', overheated: true });
    expect(gauge?.kind === 'heat' ? gauge.heat : 0).toBeGreaterThan(0.9);
  });
});
