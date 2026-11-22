import type { Transform } from '../core/Transform';
import type { Vec2 } from '../core/Vec2';

/** Opaque id for a body in a `PhysicsWorld`. Only the world that issued it understands it. */
export type BodyHandle = number;

/** Opaque id for one collider (a body can have several: a tank's hull and its barrels). */
export type ColliderHandle = number;

/** A straight capsule between two points: how barrels are shaped (M3-8b). */
export interface Segment {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly radius: number;
}

/** A static obstacle: wall segment, pillar or crate. */
export interface StaticBoxSpec {
  readonly center: Vec2;
  /** Size along the box's own x. */
  readonly width: number;
  /** Size along the box's own z. */
  readonly depth: number;
  readonly heading: number;
}

/** A vehicle's collision body: its hull footprint as an oriented box (GDD §3). */
export interface VehicleBodySpec {
  readonly transform: Transform;
  /** Along the heading. */
  readonly length: number;
  readonly width: number;
  /** Relative units; heavier bodies push harder in contacts (M2-3b). */
  readonly mass: number;
}

/** Where a body ended up after a step, in sim conventions (architecture.md §9). */
export interface BodyState {
  readonly transform: Transform;
  readonly linearVelocity: Vec2;
  /** rad/s, positive clockwise seen from above. */
  readonly angularVelocity: number;
}

/** Two bodies that pushed on each other during the last step. */
export interface ContactReport {
  readonly bodyA: BodyHandle;
  readonly bodyB: BodyHandle;
  /** Total contact impulse this step (mass × u/s): how hard they hit or pushed. */
  readonly impulse: number;
}

/** What a swept cast ran into first. */
export interface CastHit {
  readonly body: BodyHandle;
  /** The specific collider hit (e.g. a barrel rather than the hull). */
  readonly collider: ColliderHandle;
  /** Where the cast shape touched the body (on the body's surface). */
  readonly point: Vec2;
  /** The body's surface normal at `point`, pointing back toward the caster. */
  readonly normal: Vec2;
  /** 0..1: how far along the path the shape got before touching. */
  readonly fraction: number;
}

/**
 * The simulation's view of the physics engine. Game rules depend on this
 * interface, never on Rapier directly, so the engine can be swapped or faked in
 * tests without touching gameplay code (ADR-0005).
 *
 * Everything is in sim coordinates and heading convention; conversion to the
 * engine's own conventions happens inside the implementation.
 *
 * Shape casts arrived with projectiles (M3-3).
 */
export interface PhysicsWorld {
  /** Advances the physics world by one fixed simulation step of `dt` seconds. */
  step(dt: number): void;

  /** Adds an immovable box. */
  addStaticBox(spec: StaticBoxSpec): BodyHandle;

  /** Adds a vehicle body that moves by velocity and is pushed out of anything it hits. */
  addVehicleBody(spec: VehicleBodySpec): BodyHandle;

  /**
   * Adds a massless capsule to a vehicle body (a gun barrel, M3-8b): it moves
   * with the body, blocks movement like the hull, and can be re-posed.
   */
  addBarrel(body: BodyHandle, segment: Segment): ColliderHandle;

  /** Re-poses a barrel to a world-space segment (e.g. after the turret turned). */
  setBarrel(collider: ColliderHandle, segment: Segment): void;

  /**
   * True if a capsule placed at `segment` would overlap anything other than
   * the `ignore` body and the `skip` colliders.
   */
  overlaps(segment: Segment, ignore?: BodyHandle, skip?: ReadonlySet<ColliderHandle>): boolean;

  /** Sets the velocity a vehicle body moves with during the next step. */
  setVelocity(handle: BodyHandle, linear: Vec2, angular: number): void;

  /** Reads a body's transform and velocities, after contacts have been resolved. */
  readBody(handle: BodyHandle): BodyState;

  /**
   * Contacts involving a vehicle body that pushed during the last `step`
   * (vehicle against vehicle, wall or prop), in a deterministic order.
   */
  contacts(): readonly ContactReport[];

  /**
   * Sweeps a circle of `radius` from `from` to `to` and returns the first body
   * it touches, ignoring `ignore` (the shooter). A swept cast can't skip
   * through thin walls at any speed, and tests the bodies' real oriented
   * shapes, so nothing registers in empty space (GDD §11).
   */
  castCircle(from: Vec2, to: Vec2, radius: number, ignore?: BodyHandle): CastHit | undefined;

  /** Removes a body and its collider (a destroyed crate or tank). */
  removeBody(handle: BodyHandle): void;

  /** Frees engine memory. Rapier's lives in WASM, outside JavaScript's garbage collector. */
  dispose(): void;
}
