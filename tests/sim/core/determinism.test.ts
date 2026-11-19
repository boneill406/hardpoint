import { describe, expect, it } from 'vitest';
import { Simulation, type SimSnapshot } from '../../../src/sim/core/Simulation';
import { Rng } from '../../../src/sim/core/Rng';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { DebugMover } from '../../../src/sim/debug/DebugMover';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import type { PlayerId, VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';

const TICKS = 600;
const SNAPSHOT_EVERY = 60;
const MOVERS = 12;
const PLAYER: PlayerId = 1;

/**
 * Builds a world entirely from the simulation's own `Rng`, so the seed decides
 * every starting position, heading, speed and turn rate.
 */
function populateRandomMovers(simulation: Simulation): void {
  const { rng, world } = simulation;
  for (let i = 0; i < MOVERS; i++) {
    const position = new Vec2(rng.range(-20, 20), rng.range(-20, 20));
    const heading = rng.range(-Math.PI, Math.PI);
    const speed = rng.range(0.5, 6);
    const turnRate = rng.range(-2, 2);
    world.add(new DebugMover({ position, heading }, { speed, turnRate }));
  }
}

/**
 * A scripted player input stream, generated from its own seed so it is the same
 * for every run. M1 entities ignore commands; from M2-2 a player vehicle reads
 * them and this test covers "same seed + same commands → same game".
 */
function scriptedCommands(): (tick: number) => ReadonlyMap<PlayerId, VehicleCommand> {
  const script = new Rng(2026);
  return () =>
    new Map([
      [
        PLAYER,
        {
          throttle: script.range(-1, 1),
          turn: script.range(-1, 1),
          aimPoint: new Vec2(script.range(-20, 20), script.range(-20, 20)),
          firePrimary: script.chance(0.3),
          fireSecondary: script.chance(0.1),
        },
      ],
    ]);
}

interface Run {
  readonly simulation: Simulation;
  readonly trace: SimSnapshot[];
  readonly events: string[];
  readonly commandsAt: (tick: number) => ReadonlyMap<PlayerId, VehicleCommand>;
}

/** Starts a run with real Rapier, so physics bodies are covered once M2-3 adds them. */
async function startRun(seed: number): Promise<Run> {
  const simulation = new Simulation({
    seed,
    physics: await RapierPhysicsWorld.create(),
    populate: populateRandomMovers,
  });
  const events: string[] = [];
  simulation.events.on('EntitySpawned', ({ id }) => events.push(`spawned ${id}`));
  simulation.events.on('EntityDestroyed', ({ id }) => events.push(`destroyed ${id}`));
  return { simulation, trace: [simulation.snapshot()], events, commandsAt: scriptedCommands() };
}

/** One frame's worth of work for a run: tick, flush events, record a snapshot periodically. */
function stepRun(run: Run): void {
  const { simulation } = run;
  simulation.tick(run.commandsAt(simulation.tickCount));
  simulation.events.flush();
  if (simulation.tickCount % SNAPSHOT_EVERY === 0) {
    run.trace.push(simulation.snapshot());
  }
}

async function runToEnd(seed: number): Promise<Run> {
  const run = await startRun(seed);
  for (let i = 0; i < TICKS; i++) {
    stepRun(run);
  }
  run.simulation.dispose();
  return run;
}

describe('determinism', () => {
  it('the same seed produces identical snapshots every second for 600 ticks', async () => {
    const a = await runToEnd(7);
    const b = await runToEnd(7);

    // toEqual compares numbers exactly (Object.is), so this demands bit-identical floats.
    expect(a.trace).toHaveLength(TICKS / SNAPSHOT_EVERY + 1);
    expect(b.trace).toEqual(a.trace);
    expect(b.events).toEqual(a.events);
  });

  it('different seeds produce different worlds, not just different rng state', async () => {
    const a = await runToEnd(7);
    const b = await runToEnd(8);

    const finalA = a.trace.at(-1);
    const finalB = b.trace.at(-1);
    expect(finalB?.entities).not.toEqual(finalA?.entities);
  });

  it('runs stepped alternately match runs stepped one after the other (no shared hidden state)', async () => {
    const sequential = await runToEnd(7);

    const left = await startRun(7);
    const right = await startRun(7);
    for (let i = 0; i < TICKS; i++) {
      stepRun(left);
      stepRun(right);
    }
    left.simulation.dispose();
    right.simulation.dispose();

    expect(left.trace).toEqual(sequential.trace);
    expect(right.trace).toEqual(sequential.trace);
  });

  it('the movers actually move, so equal snapshots are not trivially equal', async () => {
    const run = await runToEnd(7);
    const first = run.trace[0];
    const last = run.trace.at(-1);

    expect(first?.entities).toHaveLength(MOVERS);
    expect(last?.tick).toBe(TICKS);
    expect(last?.entities).not.toEqual(first?.entities);
  });
});
