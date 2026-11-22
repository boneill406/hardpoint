import { describe, expect, it } from 'vitest';
import type { FaceRule } from '../../../src/sim/combat/ArmorDef';
import { DamageResolver } from '../../../src/sim/combat/DamageResolver';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { degToRad } from '../../../src/sim/core/angles';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { TANK_ARMOR } from '../../../src/sim/defs/armor';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { CANNON, MACHINE_GUN } from '../../../src/sim/defs/weapons';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M3-4, against real Rapier: hull hits deal armor-scaled damage, barrel hits
// deal none, and a vehicle at 0 health is removed.

const ROOM: ArenaDef = {
  name: 'Range',
  width: 60,
  depth: 60,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: Vec2.ZERO, heading: 0 },
  gates: [],
  pillars: [],
  crates: [],
};

const CANNON_HELD: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };

interface Setup {
  /** The target insurgent's hull heading; it sits at (0, 8). */
  readonly targetHeading: number;
  /** The shooter (player tank facing +z) sits at (shooterX, 0). Off-centre keeps the shot off a barrel. */
  readonly shooterX?: number;
  readonly command?: VehicleCommand;
  readonly armorRule?: FaceRule;
}

interface Result {
  readonly hits: SimEvents['Hit'][];
  readonly impacts: SimEvents['ProjectileImpact'][];
  readonly destroyed: number[];
  readonly simulation: Simulation;
  readonly target: Vehicle;
}

async function shootAt(setup: Setup, duration: number): Promise<Result> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: ROOM,
    ...(setup.armorRule === undefined ? {} : { armorRule: setup.armorRule }),
    populate: (sim) => {
      sim.world.add(
        createVehicle(PLAYER_TANK, {
          transform: { position: new Vec2(setup.shooterX ?? 0.4, 0), heading: 0 },
          faction: 'player',
          controller: new ScriptedController(() => setup.command ?? CANNON_HELD),
        }),
      );
      sim.world.add(
        createVehicle(INSURGENT_TANK, {
          transform: { position: new Vec2(0, 8), heading: setup.targetHeading },
          faction: 'insurgent',
          controller: new ScriptedController(() => IDLE_COMMAND),
        }),
      );
    },
  });
  const [, target] = simulation.world.ofType(Vehicle);
  if (target === undefined) throw new Error('setup');
  const hits: Result['hits'] = [];
  const impacts: Result['impacts'] = [];
  const destroyed: number[] = [];
  simulation.events.on('Hit', (hit) => hits.push(hit));
  simulation.events.on('ProjectileImpact', (impact) => impacts.push(impact));
  simulation.events.on('EntityDestroyed', ({ id }) => destroyed.push(id));
  for (let i = 0; i < seconds(duration); i++) {
    simulation.tick(new Map());
    simulation.events.flush();
  }
  return { hits, impacts, destroyed, simulation, target };
}

describe('damage (real Rapier)', () => {
  it('a cannon hit on the front deals 50 × 0.65 = 32.5', async () => {
    const { hits, target, simulation } = await shootAt({ targetHeading: Math.PI }, 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ target: 2, attacker: 1, weapon: 'Cannon', face: 'front' });
    expect(hits[0]?.damage).toBeCloseTo(32.5, 9);
    expect(target.health.current).toBeCloseTo(27.5, 9);
    simulation.dispose();
  });

  it('front hits deal less than side hits, which deal less than rear hits', async () => {
    const damageFrom = async (targetHeading: number): Promise<number> => {
      const { hits, simulation } = await shootAt({ targetHeading }, 1);
      simulation.dispose();
      return hits[0]?.damage ?? 0;
    };
    const front = await damageFrom(Math.PI);
    const side = await damageFrom(Math.PI / 2);
    const rear = await damageFrom(0);
    expect(front).toBeCloseTo(32.5, 9);
    expect(side).toBeCloseTo(50, 9);
    // Rear 62.5, capped at the insurgent's 60.
    expect(rear).toBeCloseTo(60, 9);
  });

  it('GDD kill counts: an insurgent dies to 2 front cannon hits, or 1 rear hit', async () => {
    const front = await shootAt({ targetHeading: Math.PI }, 2);
    expect(front.hits.map((hit) => hit.destroyed)).toEqual([false, true]);
    expect(front.destroyed).toContain(2);
    front.simulation.dispose();

    const rear = await shootAt({ targetHeading: 0 }, 1);
    expect(rear.hits).toHaveLength(1);
    expect(rear.hits[0]).toMatchObject({ face: 'rear', destroyed: true, healthLeft: 0 });
    rear.simulation.dispose();
  });

  it('a destroyed vehicle is removed from the world at the end of that tick, and shots then pass where it was', async () => {
    const { simulation, impacts, destroyed } = await shootAt({ targetHeading: 0 }, 3);
    // (Spent shells are removed too, so look for the tank's id among them.)
    expect(destroyed.filter((id) => id === 2)).toEqual([2]);
    expect(simulation.world.get(2)).toBeUndefined();
    // The second shell (fired at 1.5 s) flies on to the wall at z = 30.
    expect(impacts).toHaveLength(2);
    expect(impacts[1]?.target).toBeUndefined();
    expect(impacts[1]?.point.z).toBeCloseTo(30, 1);
    simulation.dispose();
  });

  it('a shot that stops on a barrel deals no damage', async () => {
    // Target faces the shooter with its gun along the line of fire (x = 0).
    const { hits, impacts, target, simulation } = await shootAt(
      { targetHeading: Math.PI, shooterX: 0 },
      1,
    );
    expect(impacts[0]).toMatchObject({ target: 2, part: 'barrel' });
    expect(hits).toHaveLength(0);
    expect(target.health.current).toBe(INSURGENT_TANK.health);
    simulation.dispose();
  });

  it('struck (default) counts the face the shell hit; ?armor=direction counts where it came from', async () => {
    // Hull turned 40°: the shot comes from 140° off its nose (direction: rear), but
    // its line through the hull enters the right side face first.
    const direction = await shootAt(
      { targetHeading: degToRad(40), shooterX: 0, armorRule: 'direction' },
      1,
    );
    const struck = await shootAt({ targetHeading: degToRad(40), shooterX: 0 }, 1);
    expect(direction.hits[0]?.face).toBe('rear');
    expect(struck.hits[0]?.face).toBe('side');
    expect(struck.hits[0]?.damage).toBeCloseTo(50, 9);
    direction.simulation.dispose();
    struck.simulation.dispose();
  });

  it('the machine gun deals 3 per side hit and wears an insurgent down', async () => {
    const MG: VehicleCommand = { ...IDLE_COMMAND, fireSecondary: true };
    // Coax sits 0.2 left of the turret centreline; aim the shooter so its rounds land mid-hull.
    const { hits, simulation } = await shootAt(
      { targetHeading: Math.PI / 2, shooterX: 0.2, command: MG },
      1,
    );
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((hit) => hit.face === 'side' && hit.damage === MACHINE_GUN.damage)).toBe(
      true,
    );
    simulation.dispose();
  });
});

describe('DamageResolver', () => {
  it('a vehicle already destroyed this tick takes no further hits', () => {
    const target = createVehicle(INSURGENT_TANK, {
      transform: { position: Vec2.ZERO, heading: 0 },
      faction: 'insurgent',
      controller: new ScriptedController(() => IDLE_COMMAND),
    });
    const resolver = new DamageResolver();
    const fromBehind = { target, weapon: CANNON, shotHeading: 0, normal: new Vec2(0, -1) };
    expect(resolver.resolve(fromBehind)?.destroyed).toBe(true);
    expect(resolver.resolve(fromBehind)).toBeUndefined();
  });

  it('the MG alone needs 20 side hits to destroy an insurgent (GDD §5)', () => {
    const hitsToKill = Math.ceil(INSURGENT_TANK.health / (MACHINE_GUN.damage * TANK_ARMOR.side));
    expect(hitsToKill).toBe(20);
  });
});
