import { Arena } from '../arena/Arena';
import { Projectile } from '../combat/Projectile';
import type { ArenaDef } from '../arena/ArenaDef';
import { PhysicsBridge } from '../physics/PhysicsBridge';
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
  /** The arena to play in. Its props are spawned first, before `populate`. Optional so unit tests can use an empty world. */
  readonly arena?: ArenaDef;
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
  readonly arena: Arena | undefined;
  private readonly physics: PhysicsWorld;
  private readonly bodies: PhysicsBridge;
  private ticks = 0;

  constructor(options: SimulationOptions) {
    this.rng = new Rng(options.seed);
    this.physics = options.physics;
    this.world = new World(this.events);
    this.bodies = new PhysicsBridge(this.physics);
    this.arena = options.arena === undefined ? undefined : new Arena(options.arena);
    if (this.arena !== undefined) {
      this.addWalls(this.arena);
      this.arena.spawnProps(this.world);
    }
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
    this.bodies.sync(this.world);
    this.bodies.pushVelocities(vehicles);
    this.physics.step(TICK_SECONDS);
    this.bodies.pullState(vehicles);
    for (const vehicle of vehicles) {
      vehicle.aimTurret(TICK_SECONDS);
    }
    for (const vehicle of vehicles) {
      for (const shot of vehicle.fireWeapons(TICK_SECONDS, this.rng)) {
        this.events.emit('ShotFired', {
          shooter: vehicle.id,
          slot: shot.mount.def.slot,
          weapon: shot.mount.weapon.def.name,
          origin: shot.origin,
          heading: shot.heading,
        });
        this.world.add(
          new Projectile(shot.origin, shot.heading, shot.mount.weapon.def, vehicle.id),
        );
      }
    }
    this.advanceProjectiles();
    for (const impact of this.bodies.newVehicleImpacts()) {
      this.events.emit('VehiclesCollided', impact);
    }
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

  /**
   * Tick phase 7: every projectile (including those fired this tick, so they
   * leave the muzzle at once) sweeps forward. A hit stops it at the impact
   * point; it is removed the following tick (see `Projectile.step`).
   */
  private advanceProjectiles(): void {
    for (const projectile of this.world.ofType(Projectile)) {
      const ignore = this.bodies.bodyOf(projectile.owner);
      const result = projectile.step(TICK_SECONDS, (from, to, radius) =>
        this.physics.castCircle(from, to, radius, ignore),
      );
      if (result.kind === 'flying') {
        continue;
      }
      if (result.kind === 'hit') {
        // Stays (parked at the impact point) until next tick, so it is drawn reaching the surface.
        this.events.emit('ProjectileImpact', {
          projectile: projectile.id,
          weapon: projectile.weapon.name,
          look: projectile.weapon.projectile.look,
          target: this.bodies.entityOf(result.hit.body)?.id,
          point: result.hit.point,
          normal: result.hit.normal,
        });
        continue;
      }
      this.world.remove(projectile.id);
    }
  }

  /** Walls never change, so they are added once, as plain static boxes rather than entities. */
  private addWalls(arena: Arena): void {
    for (const wall of arena.walls) {
      this.physics.addStaticBox({ ...wall, heading: 0 });
    }
  }
}
