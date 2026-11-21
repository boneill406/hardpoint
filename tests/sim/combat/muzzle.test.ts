import { describe, expect, it } from 'vitest';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';

// M3-7, against real Rapier: a barrel pressed against something can't fire
// through it, and its clearance tells the view how far to retract.

/** 20 × 20 room: the top wall's inner face is at z = 10. */
const ROOM: ArenaDef = {
  name: 'Test room',
  width: 20,
  depth: 20,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: Vec2.ZERO, heading: 0 },
  gates: [],
  pillars: [],
  crates: [],
};
const WALL = 10;
const HALF_LENGTH = PLAYER_TANK.hull.length / 2;
/** Hull front touching the top wall, facing it. */
const NOSE_TO_WALL: Transform = { position: new Vec2(0, WALL - HALF_LENGTH - 0.01), heading: 0 };

interface Tank {
  readonly def: VehicleDef;
  readonly transform: Transform;
  readonly command: VehicleCommand;
}

interface Run {
  readonly shots: (SimEvents['ShotFired'] & { tick: number })[];
  readonly impacts: (SimEvents['ProjectileImpact'] & { tick: number })[];
  readonly shooter: Vehicle;
}

async function run(tanks: Tank[], ticks: number): Promise<Run> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: ROOM,
    populate: (sim) => {
      for (const tank of tanks) {
        sim.world.add(
          createVehicle(tank.def, {
            transform: tank.transform,
            faction: 'player',
            controller: new ScriptedController(() => tank.command),
          }),
        );
      }
    },
  });
  const shots: Run['shots'] = [];
  const impacts: Run['impacts'] = [];
  simulation.events.on('ShotFired', (shot) => shots.push({ ...shot, tick: simulation.tickCount }));
  simulation.events.on('ProjectileImpact', (impact) =>
    impacts.push({ ...impact, tick: simulation.tickCount }),
  );
  for (let i = 0; i < ticks; i++) {
    simulation.tick(new Map());
    simulation.events.flush();
  }
  const [shooter] = simulation.world.ofType(Vehicle);
  if (shooter === undefined) {
    throw new Error('test setup: no shooter');
  }
  simulation.dispose();
  return { shots, impacts, shooter };
}

const FIRE: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true, fireSecondary: true };

function mountOf(vehicle: Vehicle, slot: 'primary' | 'secondary'): Vehicle['mounts'][number] {
  const mount = vehicle.mounts.find((candidate) => candidate.hardpoint.trigger === slot);
  if (mount === undefined) {
    throw new Error(`no ${slot} mount`);
  }
  return mount;
}

describe('muzzle clearance', () => {
  it('in the open both barrels are fully clear and shots start at the muzzles', async () => {
    const { shooter, shots } = await run(
      [{ def: PLAYER_TANK, transform: { position: Vec2.ZERO, heading: 0 }, command: FIRE }],
      1,
    );
    expect(mountOf(shooter, 'primary').clearance).toBe(1);
    expect(mountOf(shooter, 'secondary').clearance).toBe(1);
    expect(shots.find((shot) => shot.slot === 'primary')?.origin.z).toBeCloseTo(1.6, 9);
  });

  it('nose to a wall, the cannon is partly blocked: clear up to the barrel-wide circle touching the wall', async () => {
    const { shooter } = await run(
      [{ def: PLAYER_TANK, transform: NOSE_TO_WALL, command: IDLE_COMMAND }],
      1,
    );
    const cannon = mountOf(shooter, 'primary');
    const pivotZ = shooter.turretPivot().z;
    const expected =
      (WALL - cannon.weapon.def.barrel.radius - pivotZ) / cannon.muzzleOffset.forward;
    expect(cannon.clearance).toBeCloseTo(expected, 3);
    expect(cannon.clearance).toBeLessThan(1);
  });

  it('a shot from a blocked barrel starts short of the wall and hits it the same tick', async () => {
    const { shots, impacts } = await run(
      [{ def: PLAYER_TANK, transform: NOSE_TO_WALL, command: FIRE }],
      2,
    );
    const cannonShot = shots.find((shot) => shot.slot === 'primary');
    expect(cannonShot?.origin.z).toBeLessThan(WALL);
    const cannonImpact = impacts.find((impact) => impact.look === 'shell');
    expect(cannonImpact?.tick).toBe(cannonShot?.tick);
    expect(cannonImpact?.target).toBeUndefined();
    expect(cannonImpact?.point.z).toBeCloseTo(WALL, 2);
  });

  it('no shot ever starts inside or beyond the wall, for either gun', async () => {
    const { shots, impacts } = await run(
      [{ def: PLAYER_TANK, transform: NOSE_TO_WALL, command: FIRE }],
      30,
    );
    expect(shots.length).toBeGreaterThan(3);
    expect(shots.every((shot) => shot.origin.z < WALL)).toBe(true);
    expect(impacts.every((impact) => impact.point.z <= WALL + 1e-3)).toBe(true);
  });

  it('point-blank against another tank, the shot hits that tank, not what is behind it', async () => {
    // Enemy side-on with its near face 1 u ahead of the shooter's pivot: inside the barrel's reach.
    const shooterAt: Transform = { position: Vec2.ZERO, heading: 0 };
    const enemy: Tank = {
      def: INSURGENT_TANK,
      transform: { position: new Vec2(0, 1.75), heading: Math.PI / 2 },
      command: IDLE_COMMAND,
    };
    const { impacts, shooter } = await run(
      [{ def: PLAYER_TANK, transform: shooterAt, command: FIRE }, enemy],
      2,
    );
    expect(mountOf(shooter, 'primary').clearance).toBeLessThan(1);
    expect(impacts.find((impact) => impact.look === 'shell')?.target).toBe(2);
  });

  it('keeps the previous tick’s clearance for the view to interpolate', async () => {
    const { shooter } = await run(
      [{ def: PLAYER_TANK, transform: NOSE_TO_WALL, command: IDLE_COMMAND }],
      3,
    );
    const cannon = mountOf(shooter, 'primary');
    expect(cannon.previousClearance).toBeCloseTo(cannon.clearance, 9);
  });
});
