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
import { drive } from '../vehicles/testVehicles';
import { seconds } from './overlap';

// M3-8b, against real Rapier: barrels are solid. They stop the tank nosing in,
// stall the turret against walls, bump other tanks, and stop shots (no damage).

/** 30 × 30 room: the top wall's inner face is at z = 15. */
const ROOM: ArenaDef = {
  name: 'Barrel room',
  width: 30,
  depth: 30,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: Vec2.ZERO, heading: 0 },
  gates: [],
  pillars: [],
  crates: [],
};
const WALL = 15;

interface Tank {
  readonly def: VehicleDef;
  readonly transform: Transform;
  readonly script: (tick: number) => VehicleCommand;
}

interface Run {
  readonly simulation: Simulation;
  readonly tanks: Vehicle[];
  readonly impacts: SimEvents['ProjectileImpact'][];
  readonly collisions: SimEvents['VehiclesCollided'][];
  advance(ticks: number): void;
}

async function start(tanks: Tank[]): Promise<Run> {
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
            controller: new ScriptedController(tank.script),
          }),
        );
      }
    },
  });
  const impacts: Run['impacts'] = [];
  const collisions: Run['collisions'] = [];
  simulation.events.on('ProjectileImpact', (impact) => impacts.push(impact));
  simulation.events.on('VehiclesCollided', (collision) => collisions.push(collision));
  return {
    simulation,
    tanks: simulation.world.ofType(Vehicle),
    impacts,
    collisions,
    advance(ticks: number): void {
      for (let i = 0; i < ticks; i++) {
        simulation.tick(new Map());
        simulation.events.flush();
      }
    },
  };
}

function tankAt(run: Run, index: number): Vehicle {
  const tank = run.tanks[index];
  if (tank === undefined) {
    throw new Error(`no tank ${index}`);
  }
  return tank;
}

/** How far the cannon barrel reaches toward +z. Its capsule ends exactly at the muzzle, rounded end included. */
function cannonReachZ(tank: Vehicle): number {
  const [cannon] = tank.mounts;
  if (cannon === undefined) {
    throw new Error('no cannon');
  }
  const { from, to } = tank.barrelSegment(cannon);
  return Math.max(from.z, to.z);
}

const aimAt = (point: Vec2): VehicleCommand => ({ ...IDLE_COMMAND, aimPoint: point });

describe('solid barrels (real Rapier)', () => {
  it('nosing into a wall stops when the barrel touches it, not the hull', async () => {
    const run = await start([
      {
        def: PLAYER_TANK,
        transform: { position: new Vec2(0, 8), heading: 0 },
        script: () => drive(1),
      },
    ]);
    run.advance(seconds(3));
    const tank = tankAt(run, 0);
    expect(cannonReachZ(tank)).toBeLessThan(WALL + 0.02);
    expect(cannonReachZ(tank)).toBeGreaterThan(WALL - 0.05);
    // The barrel keeps the hull's front well clear of the wall.
    expect(tank.transform.position.z + PLAYER_TANK.hull.length / 2).toBeLessThan(WALL - 0.3);
    run.simulation.dispose();
  });

  it('a turret turning its barrel into a wall stalls there, without shoving the tank', async () => {
    // Hull facing east 1 u below the wall; the turret is told to swing north, into the wall.
    const start_: Transform = { position: new Vec2(0, WALL - 1), heading: Math.PI / 2 };
    const run = await start([
      { def: PLAYER_TANK, transform: start_, script: () => aimAt(new Vec2(0, 40)) },
    ]);
    run.advance(seconds(2));
    const tank = tankAt(run, 0);
    // Stalled part way: still pointing east of north, with the barrel at the wall.
    expect(tank.turret.heading).toBeGreaterThan(0.6);
    expect(tank.turret.heading).toBeLessThan(Math.PI / 2);
    expect(cannonReachZ(tank)).toBeLessThan(WALL + 0.02);
    expect(cannonReachZ(tank)).toBeGreaterThan(WALL - 0.1);
    expect(tank.transform.position.distanceTo(start_.position)).toBeLessThan(0.05);
    run.simulation.dispose();
  });

  it('a stalled turret turns freely again once aimed away', async () => {
    const start_: Transform = { position: new Vec2(0, WALL - 1), heading: Math.PI / 2 };
    const script = (tick: number): VehicleCommand =>
      aimAt(tick < 120 ? new Vec2(0, 40) : new Vec2(40, WALL - 1));
    const run = await start([{ def: PLAYER_TANK, transform: start_, script }]);
    run.advance(seconds(4));
    expect(tankAt(run, 0).turret.heading).toBeCloseTo(Math.PI / 2, 3);
    run.simulation.dispose();
  });

  it('driving along a wall with the barrel forward does not snag', async () => {
    const along: Transform = { position: new Vec2(-10, WALL - 0.85), heading: Math.PI / 2 };
    const run = await start([{ def: PLAYER_TANK, transform: along, script: () => drive(1) }]);
    run.advance(seconds(2));
    expect(tankAt(run, 0).transform.position.x).toBeGreaterThan(-10 + 8);
    run.simulation.dispose();
  });

  it('barrels are massless: top speed is unchanged', async () => {
    const run = await start([
      {
        def: PLAYER_TANK,
        transform: { position: new Vec2(0, -12), heading: 0 },
        script: () => drive(1),
      },
    ]);
    run.advance(seconds(1));
    expect(tankAt(run, 0).linearVelocity.length()).toBeCloseTo(PLAYER_TANK.locomotion.topSpeed, 1);
    run.simulation.dispose();
  });

  it('a barrel bumps another tank: the tank stops at its barrel tip and a collision is reported', async () => {
    const run = await start([
      {
        def: PLAYER_TANK,
        transform: { position: new Vec2(0, 0), heading: 0 },
        script: () => drive(1),
      },
      {
        def: INSURGENT_TANK,
        transform: { position: new Vec2(0, 6), heading: Math.PI / 2 },
        script: () => IDLE_COMMAND,
      },
    ]);
    run.advance(seconds(1.5));
    expect(run.collisions.length).toBeGreaterThan(0);
    // The ram knocks the lighter target back, so measure against where it ended up:
    // the barrel tip is at its near side, and the shooter's hull stays clear of it.
    const target = tankAt(run, 1);
    const nearSide = target.transform.position.z - INSURGENT_TANK.hull.width / 2;
    expect(cannonReachZ(tankAt(run, 0))).toBeLessThan(nearSide + 0.05);
    expect(tankAt(run, 0).transform.position.z + PLAYER_TANK.hull.length / 2).toBeLessThan(
      nearSide - 0.3,
    );
    run.simulation.dispose();
  });
});

describe('shots and barrels (real Rapier)', () => {
  /**
   * A target side-on to the north-east facing west: its hull spans x 0.4–2.8,
   * and its barrel reaches west to x ≈ 0, across the shooter's line of fire (x = 0).
   */
  const target: Tank = {
    def: INSURGENT_TANK,
    transform: { position: new Vec2(1.6, 8), heading: -Math.PI / 2 },
    script: () => IDLE_COMMAND,
  };
  /** Holds fire for half a second so the turret has finished turning to `aim`. */
  const shooter = (aim: Vec2): Tank => ({
    def: PLAYER_TANK,
    transform: { position: Vec2.ZERO, heading: 0 },
    script: (tick) => ({ ...IDLE_COMMAND, firePrimary: tick >= 30, aimPoint: aim }),
  });

  it('a shot that meets a barrel stops there and reports part "barrel"', async () => {
    const run = await start([shooter(new Vec2(0, 30)), target]);
    run.advance(seconds(1));
    const [impact] = run.impacts;
    expect(impact?.target).toBe(2);
    expect(impact?.part).toBe('barrel');
    run.simulation.dispose();
  });

  it('a shot at the hull reports part "body"', async () => {
    // Aimed at the target's centre: the shot meets the hull's near side before the barrel's line.
    const run = await start([shooter(new Vec2(1.6, 8)), target]);
    run.advance(seconds(1));
    const [impact] = run.impacts;
    expect(impact?.target).toBe(2);
    expect(impact?.part).toBe('body');
    run.simulation.dispose();
  });
});
