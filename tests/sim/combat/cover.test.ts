import { describe, expect, it } from 'vitest';
import type { ArenaDef, BoxDef } from '../../../src/sim/arena/ArenaDef';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M3-5 (plan D7), against real Rapier: the cannon breaks crates in one hit;
// the MG doesn't, and nothing breaks pillars.

const COVER: BoxDef = { center: new Vec2(0, 8), width: 1.5, depth: 1.5 };

interface Result {
  readonly impacts: SimEvents['ProjectileImpact'][];
  readonly destroyed: number[];
  readonly simulation: Simulation;
}

async function fireAt(
  cover: Partial<ArenaDef>,
  command: VehicleCommand,
  duration: number,
): Promise<Result> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: {
      name: 'Range',
      width: 60,
      depth: 60,
      wall: { thickness: 1, height: 2 },
      playerStart: { position: Vec2.ZERO, heading: 0 },
      gates: [],
      pillars: [],
      crates: [],
      ...cover,
    },
    populate: (sim) => {
      sim.world.add(
        createVehicle(PLAYER_TANK, {
          transform: { position: Vec2.ZERO, heading: 0 },
          faction: 'player',
          controller: new ScriptedController(() => command),
        }),
      );
    },
  });
  const impacts: Result['impacts'] = [];
  const destroyed: number[] = [];
  simulation.events.on('ProjectileImpact', (impact) => impacts.push(impact));
  simulation.events.on('EntityDestroyed', ({ id }) => destroyed.push(id));
  for (let i = 0; i < seconds(duration); i++) {
    simulation.tick(new Map());
    simulation.events.flush();
  }
  return { impacts, destroyed, simulation };
}

const CANNON: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };
const MG: VehicleCommand = { ...IDLE_COMMAND, fireSecondary: true };

describe('breakable cover (real Rapier)', () => {
  it('one cannon hit removes a crate and its collider: the next shell flies on to the wall', async () => {
    // Crate is entity 1 (props spawn first); two shells, 1.5 s apart.
    const { impacts, destroyed, simulation } = await fireAt({ crates: [COVER] }, CANNON, 2);
    expect(impacts.map((impact) => impact.target)).toEqual([1, undefined]);
    expect(destroyed).toContain(1);
    expect(simulation.world.get(1)).toBeUndefined();
    expect(impacts[1]?.point.z).toBeCloseTo(30, 1);
    simulation.dispose();
  });

  it('machine-gun rounds stop on a crate but never break it', async () => {
    const { impacts, simulation } = await fireAt({ crates: [COVER] }, MG, 2);
    expect(impacts.length).toBeGreaterThan(10);
    expect(impacts.every((impact) => impact.target === 1)).toBe(true);
    expect(simulation.world.get(1)).toBeDefined();
    simulation.dispose();
  });

  it('pillars are indestructible, even to the cannon', async () => {
    const { impacts, simulation } = await fireAt({ pillars: [COVER] }, CANNON, 2);
    expect(impacts.map((impact) => impact.target)).toEqual([1, 1]);
    expect(simulation.world.get(1)).toBeDefined();
    simulation.dispose();
  });
});
