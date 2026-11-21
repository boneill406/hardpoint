import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/sim/arena/Arena';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { degToRad } from '../../../src/sim/core/angles';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import type { VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { bareHull, drive } from '../vehicles/testVehicles';
import { hullBox, obstacleBox, penetration, seconds, TOLERANCE } from './overlap';

// M2-3a, against real Rapier. Hull collision only: the tank has no weapons
// fitted here, so barrels (M3-8b, own tests) don't keep it off the walls.
// The key check runs every tick: how deep does the
// tank's oriented hull overlap any obstacle? "Treads never visibly enter
// obstacles" (M2 done-when) means that depth stays below a hair.

const HULL_ONLY = bareHull(PLAYER_TANK);
const { length: HULL_LENGTH, width: HULL_WIDTH } = PLAYER_TANK.hull;

/** 20 × 20 room: inner wall faces at x = ±10 and z = ±10. */
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

/** Furthest the hull reaches along a world direction (e.g. +z for "how close to the top wall"). */
function reach(transform: Transform, direction: Vec2): number {
  const forward = Vec2.fromHeading(transform.heading);
  const right = Vec2.fromHeading(transform.heading + Math.PI / 2);
  return (
    transform.position.dot(direction) +
    (HULL_LENGTH / 2) * Math.abs(forward.dot(direction)) +
    (HULL_WIDTH / 2) * Math.abs(right.dot(direction))
  );
}

interface Run {
  readonly tank: Vehicle;
  /** Deepest overlap with any wall or prop seen on any tick. */
  readonly worstPenetration: number;
  /** The tank's transform after every tick. */
  readonly path: Transform[];
}

async function driveTank(
  arenaDef: ArenaDef,
  start: Transform,
  script: (tick: number) => VehicleCommand,
  ticks: number,
): Promise<Run> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: arenaDef,
    populate: (sim) => {
      sim.world.add(
        createVehicle(HULL_ONLY, {
          transform: start,
          faction: 'player',
          controller: new ScriptedController(script),
        }),
      );
    },
  });
  const arena = new Arena(arenaDef);
  const obstacles = [...arena.walls, ...arenaDef.pillars, ...arenaDef.crates].map(obstacleBox);
  const [tank] = simulation.world.ofType(Vehicle);
  if (tank === undefined) {
    throw new Error('test setup: no tank');
  }

  let worstPenetration = 0;
  const path: Transform[] = [];
  for (let i = 0; i < ticks; i++) {
    simulation.tick(new Map());
    path.push(tank.transform);
    for (const obstacle of obstacles) {
      worstPenetration = Math.max(
        worstPenetration,
        penetration(hullBox(tank.transform, PLAYER_TANK.hull), obstacle),
      );
    }
  }
  simulation.dispose();
  return { tank, worstPenetration, path };
}

const UP = new Vec2(0, 1);

describe('static collision (real Rapier)', () => {
  it('driving straight into a wall stops with the front face at the wall', async () => {
    const run = await driveTank(
      ROOM,
      { position: new Vec2(0, 4), heading: 0 },
      () => drive(1),
      seconds(3),
    );

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    expect(reach(run.tank.transform, UP)).toBeCloseTo(10, 1);
  });

  it('at 45°, the hull corner (not an invisible circle) is what touches the wall', async () => {
    const run = await driveTank(
      ROOM,
      { position: new Vec2(-5, 4), heading: degToRad(45) },
      () => drive(1),
      seconds(2),
    );

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    // The furthest corner gets right up to the wall face: nothing stops the tank early.
    const closest = Math.max(...run.path.map((transform) => reach(transform, UP)));
    expect(closest).toBeGreaterThan(10 - TOLERANCE);
  });

  it('an angled approach slides along the wall instead of sticking', async () => {
    const run = await driveTank(
      ROOM,
      { position: new Vec2(-6, 5), heading: degToRad(30) },
      () => drive(1),
      seconds(3),
    );

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    const firstContact = run.path.findIndex((transform) => reach(transform, UP) > 10 - TOLERANCE);
    expect(firstContact).toBeGreaterThan(0);
    const xAtContact = run.path[firstContact]?.position.x ?? 0;
    expect(run.tank.transform.position.x - xAtContact).toBeGreaterThan(0.5);
  });

  it('a tank flush against a wall can still pivot: the wall pushes it out instead of locking it', async () => {
    const flush = { position: new Vec2(0, 10 - HULL_LENGTH / 2 - 0.01), heading: 0 };
    const run = await driveTank(ROOM, flush, () => drive(0, 1), seconds(1));

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    expect(run.tank.transform.heading).toBeGreaterThan(1);
  });

  it.each([
    ['crate', { crates: [{ center: new Vec2(0, 5), width: 1.5, depth: 1.5 }] }],
    ['pillar', { pillars: [{ center: new Vec2(0, 5), width: 2, depth: 2 }] }],
  ])('cannot drive through a %s', async (_name, obstacle) => {
    const arena: ArenaDef = { ...ROOM, ...obstacle };
    const run = await driveTank(
      arena,
      { position: new Vec2(0, 0), heading: 0 },
      () => drive(1),
      seconds(3),
    );

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    expect(run.tank.transform.position.z).toBeLessThan(5);
  });

  it('20 s of wild driving in the slice arena never leaves it or enters an obstacle', async () => {
    // Full throttle with a turn that keeps changing direction, plus some reversing.
    const wild = (tick: number): VehicleCommand =>
      drive(tick % 400 < 340 ? 1 : -1, Math.sin(tick / 37) * Math.cos(tick / 91));
    const run = await driveTank(SLICE_ARENA, SLICE_ARENA.playerStart, wild, seconds(20));

    expect(run.worstPenetration).toBeLessThan(TOLERANCE);
    const arena = new Arena(SLICE_ARENA);
    expect(run.path.every((transform) => arena.contains(transform.position))).toBe(true);
  });
});
