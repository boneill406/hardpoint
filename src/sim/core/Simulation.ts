import { Arena } from '../arena/Arena';
import { Projectile } from '../combat/Projectile';
import { capsuleAxis, segmentDistance } from './segments';
import type { ArenaDef } from '../arena/ArenaDef';
import { PhysicsBridge } from '../physics/PhysicsBridge';
import type { PhysicsWorld, Segment } from '../physics/PhysicsWorld';
import { Vehicle } from '../vehicles/Vehicle';
import type { PlayerId, VehicleCommand } from '../vehicles/VehicleCommand';
import type { EntitySnapshot } from './Entity';
import { EventBus } from './EventBus';
import { Rng } from './Rng';
import type { SimEvents } from './SimEvents';
import { TICK_SECONDS } from './time';
import { World } from './World';

/** A turn may not deepen a barrel's overlap by more than this (u): float noise only. */
const DEPTH_EPSILON = 1e-4;

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
      const depthNow = this.barrelDepth(vehicle, vehicle.turret.heading);
      vehicle.aimTurret(
        TICK_SECONDS,
        (heading) => this.barrelDepth(vehicle, heading) <= depthNow + DEPTH_EPSILON,
      );
      this.checkMuzzleClearance(vehicle);
    }
    for (const vehicle of vehicles) {
      for (const shot of vehicle.fireWeapons(TICK_SECONDS, this.rng)) {
        this.events.emit('ShotFired', {
          shooter: vehicle.id,
          slot: shot.mount.hardpoint.trigger,
          hardpoint: shot.mount.hardpoint.id,
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
   * How deep (u) any of a vehicle's colliding turret barrels would overlap
   * something with the turret at `heading`; 0 if all are clear. The turret may
   * only turn to headings that don't deepen this (plan D16): turning into a wall
   * stalls, turning away from resting contact is always allowed, and the
   * turret can never ratchet a barrel into something and shove the hull.
   *
   * Walls, cover and hulls are measured by physics. Other barrels are measured
   * here, capsule against capsule, from each vehicle's *current* turret
   * heading: physics still has them where they were before this tick, so two
   * turrets could otherwise swing into each other in the same tick.
   */
  private barrelDepth(vehicle: Vehicle, heading: number): number {
    const ignore = this.bodies.bodyOf(vehicle.id);
    let depth = 0;
    for (const mount of vehicle.mounts) {
      if (mount.hardpoint.on !== 'turret' || !mount.weapon.def.barrel.collides) {
        continue;
      }
      const barrel = vehicle.barrelSegment(mount, heading);
      depth = Math.max(
        depth,
        this.physicsDepth(barrel, ignore),
        this.otherBarrelDepth(vehicle, barrel),
      );
    }
    return depth;
  }

  /**
   * Overlap depth against walls, cover and hulls: the barrel's radius minus the
   * largest radius that fits (halving search, 6 steps ≈ 1.5 mm at r = 0.1).
   * One query when clear; a few more only while touching something.
   */
  private physicsDepth(barrel: Segment, ignore: number | undefined): number {
    const skip = this.bodies.barrelColliderSet;
    if (!this.physics.overlaps(barrel, ignore, skip)) {
      return 0;
    }
    let fits = 0;
    let overlaps = barrel.radius;
    for (let i = 0; i < 6; i++) {
      const middle = (fits + overlaps) / 2;
      if (this.physics.overlaps({ ...barrel, radius: Math.max(0.0005, middle) }, ignore, skip)) {
        overlaps = middle;
      } else {
        fits = middle;
      }
    }
    return barrel.radius - fits;
  }

  /** Deepest overlap with any other vehicle's colliding barrel, at their current headings. */
  private otherBarrelDepth(vehicle: Vehicle, barrel: Segment): number {
    let depth = 0;
    for (const other of this.world.ofType(Vehicle)) {
      if (other === vehicle) {
        continue;
      }
      for (const mount of other.mounts) {
        if (!mount.weapon.def.barrel.collides) {
          continue;
        }
        const theirs = other.barrelSegment(mount);
        // Barrel capsules span from…to with rounded ends, so measure between centre lines.
        const ours = capsuleAxis(barrel.from, barrel.to, barrel.radius);
        const their = capsuleAxis(theirs.from, theirs.to, theirs.radius);
        const gap = segmentDistance(ours.from, ours.to, their.from, their.to);
        depth = Math.max(depth, barrel.radius + theirs.radius - gap);
      }
    }
    return depth;
  }

  /**
   * Tick phase 5b (M3-7): for each gun, sweep a barrel-wide circle from its
   * hardpoint frame's origin to the muzzle, ignoring the vehicle's own body. Where it is
   * blocked, shots start at the obstacle and the view retracts the barrel.
   */
  private checkMuzzleClearance(vehicle: Vehicle): void {
    const ignore = this.bodies.bodyOf(vehicle.id);
    for (const mount of vehicle.mounts) {
      const hit = this.physics.castCircle(
        vehicle.mountOrigin(mount),
        vehicle.muzzlePosition(mount),
        mount.weapon.def.barrel.radius,
        ignore,
      );
      mount.setClearance(hit?.fraction ?? 1);
    }
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
          part: this.bodies.isBarrel(result.hit.collider) ? 'barrel' : 'body',
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
