import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Vehicle } from '../vehicles/Vehicle';
import type { PlayerId, VehicleCommand } from '../vehicles/VehicleCommand';
import type { EntitySnapshot } from './Entity';
import { EventBus } from './EventBus';
import { Rng } from './Rng';
import type { SimEvents } from './SimEvents';
import { TICK_SECONDS } from './time';
import { World } from './World';

export interface SimulationOptions {
  /** Seeds the simulation's only random source; same seed + commands → same game. */
  readonly seed: number;
  /** Owned by the simulation from now on: stepped every tick, freed by `dispose()`. */
  readonly physics: PhysicsWorld;
  /** Adds the starting entities. Runs inside the constructor, so their spawn events are queued. */
  readonly populate?: (simulation: Simulation) => void;
}

/** The whole simulation state as plain numbers: equal snapshots mean equal games. */
export interface SimSnapshot {
  readonly tick: number;
  readonly rngState: number;
  readonly entities: readonly EntitySnapshot[];
}

/**
 * The game rules, advanced in fixed 60 Hz ticks. `tick(commands)` is the only
 * way simulation state changes (CLAUDE.md rule 3); the app calls it 0..n times
 * per frame as `FixedClock` decides, then flushes `events`.
 */
export class Simulation {
  readonly world: World;
  readonly events = new EventBus<SimEvents>();
  readonly rng: Rng;
  private readonly physics: PhysicsWorld;
  private ticks = 0;

  constructor(options: SimulationOptions) {
    this.rng = new Rng(options.seed);
    this.physics = options.physics;
    this.world = new World(this.events);
    options.populate?.(this);
  }

  /** Completed ticks since the simulation started. */
  get tickCount(): number {
    return this.ticks;
  }

  /**
   * Advances the game by one fixed step. `commands` holds each human player's
   * input for this tick; controllers pick out their own (`PlayerController`, M2-2).
   * The phase order is the tick order in architecture.md §5.
   */
  tick(commands: ReadonlyMap<PlayerId, VehicleCommand>): void {
    for (const entity of this.world.all()) {
      entity.saveTransform();
    }
    const vehicles = this.world.ofType(Vehicle);
    for (const vehicle of vehicles) {
      vehicle.applyCommand(vehicle.controller.decide({ tick: this.ticks, commands, vehicle }));
    }
    for (const vehicle of vehicles) {
      vehicle.drive(TICK_SECONDS);
    }
    for (const vehicle of vehicles) {
      vehicle.integrate(TICK_SECONDS);
    }
    this.physics.step(TICK_SECONDS);
    this.world.applyRemovals();
    this.ticks++;
  }

  snapshot(): SimSnapshot {
    return {
      tick: this.ticks,
      rngState: this.rng.getState(),
      entities: this.world.all().map((entity) => entity.snapshot()),
    };
  }

  /** Frees the physics world (Rapier memory lives outside the JS garbage collector). */
  dispose(): void {
    this.physics.dispose();
  }
}
