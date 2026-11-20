import { describe, expect, it } from 'vitest';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import type { VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { drive } from '../vehicles/testVehicles';
import { hullBox, penetration, seconds, TOLERANCE } from './overlap';

// M2-3b, against real Rapier: tanks against tanks. The player tank (mass 30,
// engine 525) is stronger than the insurgent (mass 20, engine 160, grip 1000).

/** Big open room, so walls don't interfere. */
const ROOM: ArenaDef = {
  name: 'Open room',
  width: 60,
  depth: 60,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: Vec2.ZERO, heading: 0 },
  gates: [],
  pillars: [],
  crates: [],
};

interface TankSpec {
  readonly def: VehicleDef;
  readonly start: Transform;
  readonly script: (tick: number) => VehicleCommand;
}

interface DuelResult {
  readonly a: Transform[];
  readonly b: Transform[];
  readonly worstOverlap: number;
  readonly collisions: SimEvents['VehiclesCollided'][];
  readonly ids: readonly [number, number];
}

async function duel(first: TankSpec, second: TankSpec, ticks: number): Promise<DuelResult> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: ROOM,
    populate: (sim) => {
      for (const tank of [first, second]) {
        sim.world.add(
          createVehicle(tank.def, {
            transform: tank.start,
            faction: 'player',
            controller: new ScriptedController(tank.script),
          }),
        );
      }
    },
  });
  const collisions: SimEvents['VehiclesCollided'][] = [];
  simulation.events.on('VehiclesCollided', (event) => collisions.push(event));
  const [tankA, tankB] = simulation.world.ofType(Vehicle);
  if (tankA === undefined || tankB === undefined) {
    throw new Error('test setup: two tanks expected');
  }

  const a: Transform[] = [];
  const b: Transform[] = [];
  let worstOverlap = 0;
  for (let i = 0; i < ticks; i++) {
    simulation.tick(new Map());
    simulation.events.flush();
    a.push(tankA.transform);
    b.push(tankB.transform);
    worstOverlap = Math.max(
      worstOverlap,
      penetration(
        hullBox(tankA.transform, tankA.def.hull),
        hullBox(tankB.transform, tankB.def.hull),
      ),
    );
  }
  simulation.dispose();
  return { a, b, worstOverlap, collisions, ids: [tankA.id, tankB.id] };
}

const UP: Transform = { position: new Vec2(0, -8), heading: 0 };
const DOWN_FROM_ABOVE: Transform = { position: new Vec2(0, 8), heading: Math.PI };
const PARKED_AT_ORIGIN: Transform = { position: Vec2.ZERO, heading: 0 };
const SIDE_ON_AT_ORIGIN: Transform = { position: Vec2.ZERO, heading: Math.PI / 2 };
const BELOW: Transform = { position: new Vec2(0, -6), heading: 0 };
const full = (): VehicleCommand => drive(1);
const idle = (): VehicleCommand => drive(0);

function last<T>(items: readonly T[]): T {
  const item = items.at(-1);
  if (item === undefined) {
    throw new Error('empty run');
  }
  return item;
}

describe('tank vs tank (real Rapier)', () => {
  it('a head-on clash at full speed (closing at 11 u/s) never visibly overlaps', async () => {
    const run = await duel(
      { def: PLAYER_TANK, start: UP, script: full },
      { def: INSURGENT_TANK, start: DOWN_FROM_ABOVE, script: full },
      seconds(4),
    );
    expect(run.worstOverlap).toBeLessThan(TOLERANCE);
  });

  it('head-on, the stronger tank wins: it keeps advancing and shoves the weaker one back', async () => {
    const run = await duel(
      { def: PLAYER_TANK, start: UP, script: full },
      { def: INSURGENT_TANK, start: DOWN_FROM_ABOVE, script: full },
      seconds(4),
    );
    const contact = run.a.findIndex((t, i) => {
      const other = run.b[i];
      return other !== undefined && other.position.z - t.position.z < 2.4 + 0.1;
    });
    expect(contact).toBeGreaterThan(0);
    const insurgentAtContact = run.b[contact]?.position.z ?? 0;
    expect(last(run.b).position.z).toBeGreaterThan(insurgentAtContact + 0.5);
    expect(last(run.a).position.z).toBeGreaterThan(run.a[contact]?.position.z ?? 0);
  });

  it('a weaker tank barely moves a parked stronger one (slow creep only)', async () => {
    const run = await duel(
      { def: INSURGENT_TANK, start: BELOW, script: full },
      { def: PLAYER_TANK, start: PARKED_AT_ORIGIN, script: idle },
      seconds(4),
    );
    expect(run.worstOverlap).toBeLessThan(TOLERANCE);
    expect(last(run.b).position.distanceTo(PARKED_AT_ORIGIN.position)).toBeLessThan(0.5);
  });

  it('a full-speed ram into the side knocks the weaker tank a short way, then its tracks stop it', async () => {
    // Full throttle until just after impact (~0.75 s), then let go.
    const ramThenRelease = (tick: number): VehicleCommand => drive(tick < 50 ? 1 : 0);
    const run = await duel(
      { def: PLAYER_TANK, start: BELOW, script: ramThenRelease },
      { def: INSURGENT_TANK, start: SIDE_ON_AT_ORIGIN, script: idle },
      seconds(3),
    );
    expect(run.worstOverlap).toBeLessThan(TOLERANCE);
    const knocked = last(run.b).position.z;
    expect(knocked).toBeGreaterThan(0.2);
    expect(knocked).toBeLessThan(1.5);
    expect(run.b.at(-30)?.position.z).toBeCloseTo(knocked, 2);
  });

  it('leaning on a weaker tank bulldozes it slowly (T-71: pusher engine impulse ÷ pushed mass)', async () => {
    const run = await duel(
      { def: PLAYER_TANK, start: BELOW, script: full },
      { def: INSURGENT_TANK, start: SIDE_ON_AT_ORIGIN, script: idle },
      seconds(4),
    );
    // Over the last second, long after the ram has settled.
    const creep = last(run.b).position.z - (run.b.at(-61)?.position.z ?? 0);
    const { topSpeed, accelTime } = PLAYER_TANK.locomotion;
    const expected =
      (PLAYER_TANK.mass * (topSpeed / accelTime) * TICK_SECONDS) / INSURGENT_TANK.mass;
    expect(creep).toBeCloseTo(expected, 1);
  });

  describe('VehiclesCollided', () => {
    it('fires once per impact with both ids and the impulse, not every tick of pushing', async () => {
      const run = await duel(
        { def: PLAYER_TANK, start: UP, script: full },
        { def: INSURGENT_TANK, start: DOWN_FROM_ABOVE, script: full },
        seconds(4),
      );
      expect(run.collisions).toHaveLength(1);
      expect(run.collisions[0]?.a).toBe(run.ids[0]);
      expect(run.collisions[0]?.b).toBe(run.ids[1]);
      expect(run.collisions[0]?.impulse).toBeGreaterThan(0);
    });

    it('fires again when the tanks separate and hit again', async () => {
      // Forward into the parked tank, back off, then hit it again.
      const rams = (tick: number): VehicleCommand => drive(tick < 90 ? 1 : tick < 180 ? -1 : 1);
      const run = await duel(
        { def: PLAYER_TANK, start: BELOW, script: rams },
        { def: INSURGENT_TANK, start: PARKED_AT_ORIGIN, script: idle },
        seconds(5),
      );
      expect(run.collisions).toHaveLength(2);
    });

    it('a harder hit reports a bigger impulse', async () => {
      const ram = async (throttle: number): Promise<number> => {
        const run = await duel(
          { def: PLAYER_TANK, start: BELOW, script: () => drive(throttle) },
          { def: INSURGENT_TANK, start: PARKED_AT_ORIGIN, script: idle },
          seconds(3),
        );
        return run.collisions[0]?.impulse ?? 0;
      };
      expect(await ram(1)).toBeGreaterThan((await ram(0.3)) * 2);
    });

    it('does not fire for a tank hitting a wall', async () => {
      const run = await duel(
        { def: PLAYER_TANK, start: { position: new Vec2(-20, 25), heading: 0 }, script: full },
        { def: INSURGENT_TANK, start: { position: new Vec2(20, 25), heading: 0 }, script: full },
        seconds(2),
      );
      expect(run.collisions).toEqual([]);
    });
  });
});
