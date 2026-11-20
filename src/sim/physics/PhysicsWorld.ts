import type { Transform } from '../core/Transform';
import type { Vec2 } from '../core/Vec2';

/** Opaque id for a body in a `PhysicsWorld`. Only the world that issued it understands it. */
export type BodyHandle = number;

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

/**
 * The simulation's view of the physics engine. Game rules depend on this
 * interface, never on Rapier directly, so the engine can be swapped or faked in
 * tests without touching gameplay code (ADR-0005).
 *
 * Everything is in sim coordinates and heading convention; conversion to the
 * engine's own conventions happens inside the implementation.
 *
 * Ray and shape casts are added in M3, when projectiles need them.
 */
export interface PhysicsWorld {
  /** Advances the physics world by one fixed simulation step of `dt` seconds. */
  step(dt: number): void;

  /** Adds an immovable box. */
  addStaticBox(spec: StaticBoxSpec): BodyHandle;

  /** Adds a vehicle body that moves by velocity and is pushed out of anything it hits. */
  addVehicleBody(spec: VehicleBodySpec): BodyHandle;

  /** Sets the velocity a vehicle body moves with during the next step. */
  setVelocity(handle: BodyHandle, linear: Vec2, angular: number): void;

  /** Reads a body's transform and velocities, after contacts have been resolved. */
  readBody(handle: BodyHandle): BodyState;

  /** Removes a body and its collider (a destroyed crate or tank). */
  removeBody(handle: BodyHandle): void;

  /** Frees engine memory. Rapier's lives in WASM, outside JavaScript's garbage collector. */
  dispose(): void;
}
