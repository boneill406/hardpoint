import { describe, expect, it } from 'vitest';
import { Simulation, type SimulationOptions } from '../../../src/sim/core/Simulation';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import type { ControllerContext } from '../../../src/sim/vehicles/controllers/Controller';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import {
  IDLE_COMMAND,
  type PlayerId,
  type VehicleCommand,
} from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';
import { drive, scriptedTank, TEST_TANK } from '../vehicles/testVehicles';

const SEED = 42;
const NO_COMMANDS: ReadonlyMap<PlayerId, VehicleCommand> = new Map();

/** One test tank at the origin heading +z, always at full throttle. */
function addMover(simulation: Simulation): void {
  simulation.world.add(scriptedTank(drive(1)));
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

function moverOf(simulation: Simulation): Vehicle {
  const [mover] = simulation.world.ofType(Vehicle);
  if (mover === undefined) {
    throw new Error('test setup: no Vehicle in the world');
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

  it("asks each vehicle's controller once per tick, with the tick number and that tick's commands", () => {
    const calls: ControllerContext[] = [];
    const commands: ReadonlyMap<PlayerId, VehicleCommand> = new Map([[1, drive(1)]]);
    const { simulation } = createSimulation({
      populate: (sim) => {
        sim.world.add(
          createVehicle(TEST_TANK, {
            transform: { position: Vec2.ZERO, heading: 0 },
            faction: 'player',
            controller: {
              decide: (context) => {
                calls.push(context);
                return IDLE_COMMAND;
              },
            },
          }),
        );
      },
    });

    simulation.tick(commands);
    simulation.tick(commands);

    expect(calls.map((call) => call.tick)).toEqual([0, 1]);
    expect(calls[0]?.commands).toBe(commands);
    expect(calls[0]?.vehicle).toBe(moverOf(simulation));
  });

  it("a vehicle follows its controller's command through the tick phases", () => {
    const { simulation } = createSimulation();
    runTicks(simulation, 60);
    const tank = moverOf(simulation);
    expect(tank.command).toEqual(drive(1));
    expect(tank.linearVelocity.z).toBeCloseTo(TEST_TANK.locomotion.topSpeed, 9);
    expect(tank.transform.position.z).toBeCloseTo(7.5, 0);
    expect(tank.transform.position.x).toBeCloseTo(0, 9);
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
    expect(snapshot.entities[0]?.z).toBeCloseTo(7.5, 0);
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
    expect(moverOf(simulation).transform.position.z).toBeCloseTo(7.5, 0);
    simulation.dispose();
  });
});
