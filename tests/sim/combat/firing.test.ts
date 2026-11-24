import { describe, expect, it } from 'vitest';
import { degToRad } from '../../../src/sim/core/angles';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';

type Shot = SimEvents['ShotFired'];

/** Runs one parked tank at the origin (facing +z) with a fixed command; returns every ShotFired. */
function shotsFrom(def: VehicleDef, command: VehicleCommand, ticks: number, seed = 1): Shot[] {
  const simulation = new Simulation({
    seed,
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

const PRIMARY: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };
const SECONDARY: VehicleCommand = { ...IDLE_COMMAND, fireSecondary: true };

describe('vehicle firing', () => {
  it('holding primary fires the cannon every 1.5 s from the barrel tip', () => {
    const shots = shotsFrom(PLAYER_TANK, PRIMARY, 200);
    expect(shots).toHaveLength(3);
    const [first] = shots;
    expect(first?.shooter).toBe(1);
    expect(first?.slot).toBe('primary');
    expect(first?.weapon).toBe('Cannon');
    expect(first?.heading).toBe(0);
    // Turret pivot 0.05 behind the hull centre, muzzle 1.65 along the turret.
    expect(first?.origin.x).toBeCloseTo(0, 12);
    expect(first?.origin.z).toBeCloseTo(1.6, 12);
  });

  it('holding secondary fires the coaxial MG from left of the cannon, 12 rounds per second', () => {
    const shots = shotsFrom(PLAYER_TANK, SECONDARY, 60);
    expect(shots).toHaveLength(12);
    expect(shots.every((shot) => shot.slot === 'secondary' && shot.weapon === 'Machine gun')).toBe(
      true,
    );
    expect(shots[0]?.origin.x).toBeCloseTo(-0.2, 12);
    expect(shots[0]?.origin.z).toBeCloseTo(0.85, 12);
  });

  it('muzzles follow the turret: aimed east, the cannon fires east from the turret’s right', () => {
    const aimEast: VehicleCommand = { ...PRIMARY, aimPoint: new Vec2(20, -0.05) };
    const shots = shotsFrom(PLAYER_TANK, aimEast, 200);
    const settled = shots.at(-1);
    expect(settled?.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(settled?.origin.x).toBeCloseTo(1.65, 9);
    expect(settled?.origin.z).toBeCloseTo(-0.05, 9);
  });

  it('MG spread stays within its 1° cone and varies shot to shot', () => {
    const headings = shotsFrom(PLAYER_TANK, SECONDARY, 120).map((shot) => shot.heading);
    expect(Math.max(...headings.map(Math.abs))).toBeLessThanOrEqual(degToRad(0.5));
    expect(new Set(headings).size).toBeGreaterThan(10);
  });

  it('spread is deterministic: the same seed gives the same shots, a different seed different ones', () => {
    const a = shotsFrom(PLAYER_TANK, SECONDARY, 60, 7).map((shot) => shot.heading);
    const b = shotsFrom(PLAYER_TANK, SECONDARY, 60, 7).map((shot) => shot.heading);
    const c = shotsFrom(PLAYER_TANK, SECONDARY, 60, 8).map((shot) => shot.heading);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it('the insurgent has only a cannon: its secondary trigger fires nothing', () => {
    expect(shotsFrom(INSURGENT_TANK, SECONDARY, 120)).toEqual([]);
    // Windup 0.5 s, reload 2.4 s, windup 0.5 s: two shots by 3.4 s (204 ticks).
    expect(shotsFrom(INSURGENT_TANK, PRIMARY, 220).map((shot) => shot.weapon)).toEqual([
      'Insurgent cannon',
      'Insurgent cannon',
    ]);
  });
});
