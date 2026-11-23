import { describe, expect, it } from 'vitest';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import type { SimQueries } from '../../../src/sim/core/SimQueries';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { VEHICLE_AVOIDANCE } from '../../../src/sim/defs/ai';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import type { ControllerContext } from '../../../src/sim/vehicles/controllers/Controller';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M4-3, against real Rapier: what controllers can ask about the world.

function room(extra: Partial<ArenaDef> = {}): ArenaDef {
  return {
    name: 'Room',
    width: 40,
    depth: 40,
    wall: { thickness: 1, height: 2 },
    playerStart: { position: Vec2.ZERO, heading: 0 },
    gates: [],
    pillars: [],
    crates: [],
    ...extra,
  };
}

interface Setup {
  readonly arena?: ArenaDef;
  readonly tanks: readonly Transform[];
  /** Tank 1's command (the others idle). */
  readonly command?: VehicleCommand;
}

/** Runs one tick and returns the queries the first controller was handed, plus the sim. */
async function queriesFor(setup: Setup): Promise<{ world: SimQueries; simulation: Simulation }> {
  let seen: SimQueries | undefined;
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: setup.arena ?? room(),
    populate: (sim) => {
      setup.tanks.forEach((transform, i) => {
        sim.world.add(
          createVehicle(i === 0 ? PLAYER_TANK : INSURGENT_TANK, {
            transform,
            faction: i === 0 ? 'player' : 'insurgent',
            controller: {
              decide: (context: ControllerContext) => {
                if (i === 0) {
                  seen = context.world;
                }
                return i === 0 ? (setup.command ?? IDLE_COMMAND) : IDLE_COMMAND;
              },
            },
          }),
        );
      });
    },
  });
  simulation.tick(new Map());
  if (seen === undefined) throw new Error('controller was not called');
  return { world: seen, simulation };
}

const at = (x: number, z: number, heading = 0): Transform => ({
  position: new Vec2(x, z),
  heading,
});

describe('SimQueries: line of sight (real Rapier)', () => {
  it('open ground is clear; a pillar in between blocks it', async () => {
    const pillar = { center: new Vec2(0, 5), width: 2, depth: 2 };
    const { world, simulation } = await queriesFor({
      arena: room({ pillars: [pillar] }),
      tanks: [at(15, -15)],
    });
    expect(world.lineOfSight(new Vec2(-5, 0), new Vec2(-5, 10))).toBe(true);
    expect(world.lineOfSight(new Vec2(0, 0), new Vec2(0, 10))).toBe(false);
    simulation.dispose();
  });

  it("a tank's own hull and barrels never block its view; the target being hit counts as clear", async () => {
    const { world, simulation } = await queriesFor({ tanks: [at(0, 0), at(0, 10)] });
    const [me, them] = world.vehicles();
    if (me === undefined || them === undefined) throw new Error('setup');
    const sight = { viewer: me.id, target: them.id };
    expect(world.lineOfSight(me.turretPivot(), them.transform.position, sight)).toBe(true);
    // Without naming the viewer, the ray starts inside its own hull and is blocked at once.
    expect(world.lineOfSight(me.turretPivot(), them.transform.position, { target: them.id })).toBe(
      false,
    );
    simulation.dispose();
  });

  it('another tank in between blocks the view', async () => {
    const { world, simulation } = await queriesFor({
      tanks: [at(0, 0), at(0, 12), at(0, 6, Math.PI / 2)],
    });
    const [me, target] = world.vehicles();
    if (me === undefined || target === undefined) throw new Error('setup');
    const sight = { viewer: me.id, target: target.id };
    expect(world.lineOfSight(me.turretPivot(), target.transform.position, sight)).toBe(false);
    simulation.dispose();
  });

  it('a line just past the corner of a 45°-turned tank is clear (real shapes, not boxes around them)', async () => {
    // Same geometry as the M3-3 projectile test: bounds would reach x ≈ 0.69, the hull does not.
    const { world, simulation } = await queriesFor({
      tanks: [at(0, -10), at(2.1, 12, Math.PI / 4)],
    });
    expect(world.lineOfSight(new Vec2(0, 0), new Vec2(0, 18))).toBe(true);
    simulation.dispose();
  });

  it('a crate blocks the view until the cannon breaks it', async () => {
    const crate = { center: new Vec2(0, 8), width: 1.5, depth: 1.5 };
    const setup: Setup = {
      arena: room({ crates: [crate] }),
      tanks: [at(0, 0)],
      command: { ...IDLE_COMMAND, firePrimary: true },
    };
    const { world, simulation } = await queriesFor(setup);
    const [me] = world.vehicles();
    if (me === undefined) throw new Error('setup');
    const beyond = new Vec2(0, 15);
    expect(world.lineOfSight(me.turretPivot(), beyond, { viewer: me.id })).toBe(false);
    for (let i = 0; i < seconds(0.5); i++) {
      simulation.tick(new Map());
    }
    expect(world.lineOfSight(me.turretPivot(), beyond, { viewer: me.id })).toBe(true);
    simulation.dispose();
  });
});

describe('SimQueries: vehicles and paths (real Rapier)', () => {
  it('lists every vehicle in world order, and finds one by id', async () => {
    const { world, simulation } = await queriesFor({ tanks: [at(0, 0), at(5, 5)] });
    expect(world.vehicles().map((vehicle) => vehicle.faction)).toEqual(['player', 'insurgent']);
    expect(world.vehicle(2)?.transform.position).toEqual(new Vec2(5, 5));
    expect(world.vehicle(99)).toBeUndefined();
    simulation.dispose();
  });

  it('a path for one tank bends around another tank, but not around itself', async () => {
    // Tank 2 parked on the straight line from tank 1 to the goal.
    const { world, simulation } = await queriesFor({ tanks: [at(0, -10), at(0, 0, Math.PI / 2)] });
    const goal = new Vec2(0, 10);
    const from = new Vec2(0, -10);
    const plain = world.findPath(from, goal);
    expect(plain).toEqual([goal]);
    const routed = world.findPath(from, goal, 1);
    expect(routed?.length).toBeGreaterThan(1);
    const { radius } = VEHICLE_AVOIDANCE;
    // No waypoint inside the other tank's avoidance disc.
    expect(routed?.every((point) => point.length() >= radius - 0.5)).toBe(true);
    simulation.dispose();
  });

  it('exposes the current nav grid, replaced when cover breaks', async () => {
    const crate = { center: new Vec2(0, 8), width: 1.5, depth: 1.5 };
    const { world, simulation } = await queriesFor({
      arena: room({ crates: [crate] }),
      tanks: [at(0, 0)],
      command: { ...IDLE_COMMAND, firePrimary: true },
    });
    const before = world.navGrid;
    for (let i = 0; i < seconds(0.5); i++) {
      simulation.tick(new Map());
    }
    expect(world.navGrid).not.toBe(before);
    expect(world.navGrid?.isOpenAt(new Vec2(0, 8))).toBe(true);
    simulation.dispose();
  });
});
