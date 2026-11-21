import { describe, expect, it } from 'vitest';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { Projectile } from '../../../src/sim/combat/Projectile';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { CANNON } from '../../../src/sim/defs/weapons';
import type { CastHit } from '../../../src/sim/physics/PhysicsWorld';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M3-3, against real Rapier: shots travel, stop on what they hit, and never
// register in empty space.

/** 60 × 60 room (inner walls at ±30), plus whatever cover a test adds. */
function room(extra: Partial<ArenaDef> = {}): ArenaDef {
  return {
    name: 'Range',
    width: 60,
    depth: 60,
    wall: { thickness: 1, height: 2 },
    playerStart: { position: Vec2.ZERO, heading: 0 },
    gates: [],
    pillars: [],
    crates: [],
    ...extra,
  };
}

interface TankSpec {
  readonly def: VehicleDef;
  readonly transform: Transform;
  readonly command: VehicleCommand;
}

interface RangeResult {
  readonly impacts: SimEvents['ProjectileImpact'][];
  readonly shots: number;
  readonly ids: number[];
  readonly simulation: Simulation;
}

async function range(arena: ArenaDef, tanks: TankSpec[], ticks: number): Promise<RangeResult> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena,
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
  const impacts: SimEvents['ProjectileImpact'][] = [];
  let shots = 0;
  simulation.events.on('ProjectileImpact', (impact) => impacts.push(impact));
  simulation.events.on('ShotFired', () => shots++);
  for (let i = 0; i < ticks; i++) {
    simulation.tick(new Map());
    simulation.events.flush();
  }
  const ids = simulation.world.all().map((entity) => entity.id);
  return { impacts, shots, ids, simulation };
}

/** A tank at the origin facing +z (turret too), with a held trigger. */
const shooter = (command: VehicleCommand, def: VehicleDef = PLAYER_TANK): TankSpec => ({
  def,
  transform: { position: Vec2.ZERO, heading: 0 },
  command,
});
const CANNON_ONCE: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };
const MG: VehicleCommand = { ...IDLE_COMMAND, fireSecondary: true };

describe('Projectile', () => {
  it('flies straight at its speed from the muzzle', () => {
    const shell = new Projectile(new Vec2(0, 1.6), 0, CANNON, 1);
    for (let i = 0; i < 30; i++) {
      shell.step(1 / 60, () => undefined);
    }
    expect(shell.transform.position.z).toBeCloseTo(1.6 + CANNON.projectile.speed / 2, 9);
    expect(shell.transform.position.x).toBeCloseTo(0, 12);
  });

  it('expires after its lifetime if nothing stops it', () => {
    const shell = new Projectile(Vec2.ZERO, 0, CANNON, 1);
    const results = Array.from({ length: 120 }, () => shell.step(1 / 60, () => undefined).kind);
    expect(results.slice(0, 119).every((kind) => kind === 'flying')).toBe(true);
    expect(results[119]).toBe('expired');
  });

  it('a cannon shell stops at the wall and reports where and which way the wall faces', async () => {
    const { impacts } = await range(room(), [shooter(CANNON_ONCE)], seconds(1));
    expect(impacts).toHaveLength(1);
    const [impact] = impacts;
    expect(impact?.target).toBeUndefined();
    expect(impact?.weapon).toBe('Cannon');
    expect(impact?.look).toBe('shell');
    expect(impact?.point.z).toBeCloseTo(30, 2);
    expect(impact?.normal.z).toBeCloseTo(-1, 6);
  });

  it('an MG round at 100 u/s (1.7 u per tick) cannot tunnel through a 0.2 u plate', async () => {
    const plate = { center: new Vec2(0, 10), width: 4, depth: 0.2 };
    const { impacts } = await range(room({ pillars: [plate] }), [shooter(MG)], seconds(1));
    expect(impacts.length).toBeGreaterThan(5);
    expect(impacts.every((impact) => impact.point.z <= 10)).toBe(true);
  });

  it('MG rounds leaving a muzzle over the shooter’s own hull do not hit the shooter', async () => {
    const { impacts } = await range(room(), [shooter(MG)], seconds(1));
    expect(impacts.every((impact) => impact.target === undefined)).toBe(true);
  });

  it('hits another tank and names it as the target; the shot is removed', async () => {
    const target: TankSpec = {
      def: INSURGENT_TANK,
      transform: { position: new Vec2(0, 12), heading: Math.PI / 2 },
      command: IDLE_COMMAND,
    };
    const { impacts, ids } = await range(room(), [shooter(CANNON_ONCE), target], seconds(1));
    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.target).toBe(2);
    // Side-on target: hull 1.6 wide, so its near face is at z = 12 − 0.8.
    expect(impacts[0]?.point.z).toBeCloseTo(11.2, 2);
    expect(ids).toEqual([1, 2]);
  });

  it('a shot past the corner of a 45°-turned tank misses it (no hits in empty space)', async () => {
    // Tank at (2.1, 12) turned 45°: its axis-aligned bounds reach x ≈ 0.69, but its real hull
    // edge along the shot's line (x = 0) is well clear. The prototype's box test would hit here.
    const diagonal: TankSpec = {
      def: INSURGENT_TANK,
      transform: { position: new Vec2(2.1, 12), heading: Math.PI / 4 },
      command: IDLE_COMMAND,
    };
    const { impacts } = await range(room(), [shooter(CANNON_ONCE), diagonal], seconds(1));
    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.target).toBeUndefined();
  });

  it('stops at cover and names the crate', async () => {
    const crate = { center: new Vec2(0, 8), width: 1.5, depth: 1.5 };
    const { impacts } = await range(room({ crates: [crate] }), [shooter(CANNON_ONCE)], seconds(1));
    expect(impacts[0]?.target).toBe(1);
    expect(impacts[0]?.point.z).toBeCloseTo(8 - 0.75, 2);
  });

  it('every shot ends in exactly one impact or expiry: none linger', async () => {
    // 30 rounds in 2.5 s, then the MG is overheated until 5.3 s; the rest of the run lets the last rounds land.
    const { shots, impacts, ids } = await range(room(), [shooter(MG)], seconds(3.5));
    expect(shots).toBe(30);
    expect(impacts).toHaveLength(30);
    expect(ids).toEqual([1]);
  });
});

describe('Projectile after a hit', () => {
  it('stays parked at the impact point for one tick, so it is drawn reaching the surface, then goes', () => {
    const shell = new Projectile(Vec2.ZERO, 0, CANNON, 1);
    const wallAt = (from: Vec2, to: Vec2): CastHit | undefined =>
      to.z >= 5
        ? {
            body: 9,
            point: new Vec2(0, 5),
            normal: new Vec2(0, -1),
            fraction: (5 - 0.07 - from.z) / (to.z - from.z),
          }
        : undefined;
    const kinds: string[] = [];
    for (let i = 0; i < 6; i++) {
      shell.saveTransform();
      kinds.push(shell.step(1 / 60, wallAt).kind);
    }
    // Flies until the step that would carry its front past z = 5, hits there, then is spent.
    const step = CANNON.projectile.speed / 60;
    const flyingTicks = Math.floor((5 - 0.07) / step);
    expect(kinds).toEqual([
      ...Array<string>(flyingTicks).fill('flying'),
      'hit',
      'spent',
      ...Array<string>(4 - flyingTicks).fill('spent'),
    ]);
    // Parked: the tick after the hit, previous and current are both the impact position.
    expect(shell.transform.position.z).toBeCloseTo(5 - 0.07, 9);
    expect(shell.previousTransform.position.z).toBeCloseTo(5 - 0.07, 9);
    expect(shell.velocity.length()).toBe(0);
    expect(shell.hasImpacted).toBe(true);
  });

  it('the impact event fires once, and the shot is gone the tick after', async () => {
    const { impacts, ids } = await range(room(), [shooter(CANNON_ONCE)], seconds(1));
    expect(impacts).toHaveLength(1);
    expect(ids).toEqual([1]);
  });
});
