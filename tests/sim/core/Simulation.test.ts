import { describe, expect, it } from 'vitest';
import { Simulation, type SimulationOptions } from '../../../src/sim/core/Simulation';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { DebugMover } from '../../../src/sim/debug/DebugMover';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';

const SEED = 42;
const NO_COMMANDS = new Map();
const SPEED = 3;

/** One mover at the origin heading +z, at `SPEED` u/s, not turning. */
function addMover(simulation: Simulation): void {
  simulation.world.add(
    new DebugMover({ position: Vec2.ZERO, heading: 0 }, { speed: SPEED, turnRate: 0 }),
  );
}

function createSimulation(options: Partial<SimulationOptions> = {}): {
  simulation: Simulation;
  physics: FakePhysicsWorld;
} {
  const physics = new FakePhysicsWorld();
  const simulation = new Simulation({ seed: SEED, physics, populate: addMover, ...options });
  return { simulation, physics };
}

function runTicks(simulation: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    simulation.tick(NO_COMMANDS);
  }
}

function moverOf(simulation: Simulation): DebugMover {
  const [mover] = simulation.world.ofType(DebugMover);
  if (mover === undefined) {
    throw new Error('test setup: no DebugMover in the world');
  }
  return mover;
}

describe('Simulation', () => {
  it('counts ticks', () => {
    const { simulation } = createSimulation();
    expect(simulation.tickCount).toBe(0);
    runTicks(simulation, 3);
    expect(simulation.tickCount).toBe(3);
  });

  it('steps physics exactly once per tick, with the fixed 1/60 s step', () => {
    const { simulation, physics } = createSimulation();
    runTicks(simulation, 4);
    expect(physics.steps).toEqual([TICK_SECONDS, TICK_SECONDS, TICK_SECONDS, TICK_SECONDS]);
  });

  it('previousTransform holds the transform from the end of the last tick', () => {
    const { simulation } = createSimulation();
    runTicks(simulation, 10);
    const mover = moverOf(simulation);
    const afterTen = mover.transform;

    simulation.tick(NO_COMMANDS);

    expect(mover.previousTransform).toBe(afterTen);
    expect(mover.transform.position.z).toBeGreaterThan(afterTen.position.z);
  });

  it('a mover covers speed × 1 s in 60 ticks', () => {
    const { simulation } = createSimulation();
    runTicks(simulation, 60);
    const { position } = moverOf(simulation).transform;
    expect(position.z).toBeCloseTo(SPEED, 9);
    expect(position.x).toBeCloseTo(0, 9);
  });

  it('applies removals at the end of the tick and queues EntityDestroyed', () => {
    const { simulation } = createSimulation();
    const destroyed: number[] = [];
    simulation.events.on('EntityDestroyed', ({ id }) => destroyed.push(id));
    const mover = moverOf(simulation);

    simulation.world.remove(mover.id);
    simulation.tick(NO_COMMANDS);
    simulation.events.flush();

    expect(simulation.world.all()).toEqual([]);
    expect(destroyed).toEqual([mover.id]);
  });

  it('populate runs in the constructor and its spawn events wait for the first flush', () => {
    const { simulation } = createSimulation();
    const spawned: number[] = [];
    simulation.events.on('EntitySpawned', ({ id }) => spawned.push(id));
    simulation.events.flush();
    expect(spawned).toEqual([1]);
  });

  it('snapshot captures tick, rng state and every entity as plain numbers', () => {
    const { simulation } = createSimulation();
    runTicks(simulation, 60);
    const snapshot = simulation.snapshot();

    expect(snapshot.tick).toBe(60);
    expect(snapshot.rngState).toBe(simulation.rng.getState());
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0]?.z).toBeCloseTo(SPEED, 9);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('dispose frees the physics world it owns', () => {
    const { simulation, physics } = createSimulation();
    simulation.dispose();
    expect(physics.disposed).toBe(true);
  });

  it('runs with real Rapier physics', async () => {
    const simulation = new Simulation({
      seed: SEED,
      physics: await RapierPhysicsWorld.create(),
      populate: addMover,
    });
    runTicks(simulation, 60);
    expect(moverOf(simulation).transform.position.z).toBeCloseTo(SPEED, 9);
    simulation.dispose();
  });
});
