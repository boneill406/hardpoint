import { describe, expect, it } from 'vitest';
import { Simulation, type SimSnapshot } from '../../../src/sim/core/Simulation';
import { Rng } from '../../../src/sim/core/Rng';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { PlayerController } from '../../../src/sim/vehicles/controllers/PlayerController';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import {
  IDLE_COMMAND,
  type PlayerId,
  type VehicleCommand,
} from '../../../src/sim/vehicles/VehicleCommand';

const TICKS = 600;
const SNAPSHOT_EVERY = 60;
const MOVERS = 12;
const PLAYER: PlayerId = 1;

/**
 * Builds a world entirely from the simulation's own `Rng`: the seed decides every
 * tank's def, start, and scripted driving (throttle, turn, and how often it
 * flips between forward and reverse, which exercises acceleration and braking).
 */
function populateRandomMovers(simulation: Simulation): void {
  const { rng, world } = simulation;
  world.add(
    createVehicle(PLAYER_TANK, {
      transform: { position: Vec2.ZERO, heading: 0 },
      faction: 'player',
      controller: new PlayerController(PLAYER),
    }),
  );
  for (let i = 0; i < MOVERS; i++) {
    const position = new Vec2(rng.range(-20, 20), rng.range(-20, 20));
    const heading = rng.range(-Math.PI, Math.PI);
    const throttle = rng.range(0.3, 1);
    const turn = rng.range(-1, 1);
    const flipEvery = rng.int(30, 120);
    const controller = new ScriptedController((tick) => ({
      ...IDLE_COMMAND,
      throttle: Math.floor(tick / flipEvery) % 2 === 0 ? throttle : -throttle,
      turn,
    }));
    world.add(
      createVehicle(rng.chance(0.5) ? PLAYER_TANK : INSURGENT_TANK, {
        transform: { position, heading },
        faction: 'player',
        controller,
      }),
    );
  }
}

/**
 * A scripted player input stream, generated from its own seed so it is the same
 * for every run. The player tank (`PlayerController`) drives by it, so these
 * tests cover "same seed + same commands → same game".
 */
function scriptedCommands(
  scriptSeed: number,
): (tick: number) => ReadonlyMap<PlayerId, VehicleCommand> {
  const script = new Rng(scriptSeed);
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
async function startRun(seed: number, scriptSeed = 2026): Promise<Run> {
  const simulation = new Simulation({
    seed,
    physics: await RapierPhysicsWorld.create(),
    populate: populateRandomMovers,
  });
  const events: string[] = [];
  simulation.events.on('EntitySpawned', ({ id }) => events.push(`spawned ${id}`));
  simulation.events.on('EntityDestroyed', ({ id }) => events.push(`destroyed ${id}`));
  return {
    simulation,
    trace: [simulation.snapshot()],
    events,
    commandsAt: scriptedCommands(scriptSeed),
  };
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

async function runToEnd(seed: number, scriptSeed?: number): Promise<Run> {
  const run = await startRun(seed, scriptSeed);
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

    expect(first?.entities).toHaveLength(MOVERS + 1);
    expect(last?.tick).toBe(TICKS);
    expect(last?.entities).not.toEqual(first?.entities);
  });

  it('the same seed with a different command stream produces a different game', async () => {
    const a = await runToEnd(7, 2026);
    const b = await runToEnd(7, 2027);

    const playerOf = (run: Run): unknown => run.trace.at(-1)?.entities[0];
    expect(playerOf(b)).not.toEqual(playerOf(a));
  });

  it('the player tank drives by the command stream', async () => {
    const run = await startRun(7);
    const [player] = run.simulation.world.ofType(Vehicle);
    for (let i = 0; i < 60; i++) {
      stepRun(run);
    }
    expect(player?.controller).toBeInstanceOf(PlayerController);
    expect(player?.command).not.toBe(IDLE_COMMAND);
    expect(player?.transform.position.length()).toBeGreaterThan(0);
    run.simulation.dispose();
  });
});
