import { describe, expect, it } from 'vitest';
import type { WeaponDef } from '../../../src/sim/combat/WeaponDef';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { CANNON, MACHINE_GUN } from '../../../src/sim/defs/weapons';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { HardpointDef, VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';

type Shot = SimEvents['ShotFired'];

/** Fires a tank parked at the origin (hull and turret facing +z) for `ticks`; returns its shots. */
function shotsOf(def: VehicleDef, command: VehicleCommand, ticks: number): Shot[] {
  const simulation = new Simulation({
    seed: 1,
    physics: new FakePhysicsWorld(),
    populate: (sim) => {
      sim.world.add(
        createVehicle(def, {
          transform: { position: Vec2.ZERO, heading: 0 },
          faction: 'player',
          controller: new ScriptedController(() => command),
        }),
      );
    },
  });
  const shots: Shot[] = [];
  simulation.events.on('ShotFired', (shot) => shots.push(shot));
  for (let i = 0; i < ticks; i++) {
    simulation.tick(new Map());
    simulation.events.flush();
  }
  return shots;
}

const spawn = {
  transform: { position: Vec2.ZERO, heading: 0 },
  faction: 'player' as const,
  controller: new ScriptedController(() => IDLE_COMMAND),
};
const PRIMARY: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };
const SECONDARY: VehicleCommand = { ...IDLE_COMMAND, fireSecondary: true };
const TURRET_PIVOT = PLAYER_TANK.turret.pivotForward;

describe('hardpoints and loadouts', () => {
  it('derives the muzzle from hardpoint + barrel: a longer barrel fires from further out', () => {
    const longGun: WeaponDef = { ...CANNON, barrel: { ...CANNON.barrel, length: 1.5 } };
    const def: VehicleDef = { ...PLAYER_TANK, loadout: { main: longGun } };
    const [shot] = shotsOf(def, PRIMARY, 1);
    expect(shot?.hardpoint).toBe('main');
    expect(shot?.origin.z).toBeCloseTo(TURRET_PIVOT + 0.6 + 1.5, 9);
  });

  it('an empty hardpoint fires nothing on its trigger', () => {
    const def: VehicleDef = { ...PLAYER_TANK, loadout: { main: CANNON } };
    expect(shotsOf(def, SECONDARY, 60)).toEqual([]);
  });

  it('twin guns alternate between their muzzles', () => {
    const twin: WeaponDef = {
      ...MACHINE_GUN,
      muzzles: [{ right: -0.05 }, { right: 0.05 }],
      spread: 0,
    };
    const def: VehicleDef = { ...PLAYER_TANK, loadout: { ...PLAYER_TANK.loadout, coax: twin } };
    const xs = shotsOf(def, SECONDARY, 20).map((shot) => shot.origin.x);
    // Coax hardpoint sits 0.2 left; the twin muzzles are 0.05 either side of it.
    expect(xs.slice(0, 4).map((x) => Number(x.toFixed(9)))).toEqual([-0.25, -0.15, -0.25, -0.15]);
  });

  it('a hull hardpoint fires along the hull, wherever the turret aims', () => {
    const hullGun: HardpointDef = {
      id: 'hull-mg',
      on: 'hull',
      at: { forward: 1.2, right: 0.3 },
      size: 'small',
      trigger: 'secondary',
      height: 0,
    };
    const def: VehicleDef = {
      ...PLAYER_TANK,
      hardpoints: [...PLAYER_TANK.hardpoints, hullGun],
      loadout: { main: CANNON, 'hull-mg': { ...MACHINE_GUN, spread: 0 } },
    };
    const aimEast: VehicleCommand = { ...SECONDARY, aimPoint: new Vec2(20, 0) };
    const shots = shotsOf(def, aimEast, 60);
    expect(shots.every((shot) => shot.hardpoint === 'hull-mg' && shot.heading === 0)).toBe(true);
    expect(shots[0]?.origin.z).toBeCloseTo(1.2 + MACHINE_GUN.barrel.length, 9);
    expect(shots[0]?.origin.x).toBeCloseTo(0.3, 9);
  });

  it('rejects a weapon on a hardpoint of the wrong size', () => {
    const def: VehicleDef = { ...PLAYER_TANK, loadout: { coax: CANNON } };
    expect(() => createVehicle(def, spawn)).toThrow('doesn’t fit'.replace('’', "'"));
  });

  it('rejects a loadout naming a hardpoint the chassis does not have', () => {
    const def: VehicleDef = { ...PLAYER_TANK, loadout: { roof: MACHINE_GUN } };
    expect(() => createVehicle(def, spawn)).toThrow('unknown hardpoint "roof"');
  });

  it('rejects duplicate hardpoint ids', () => {
    const [main] = PLAYER_TANK.hardpoints;
    if (main === undefined) throw new Error('setup');
    const def: VehicleDef = { ...PLAYER_TANK, hardpoints: [main, main] };
    expect(() => createVehicle(def, spawn)).toThrow('unique');
  });
});
