import type { Vec2 } from '../../core/Vec2';
import type { VehicleCommand } from '../VehicleCommand';

/** A vehicle's current motion, as locomotion needs to see it. */
export interface MotionState {
  readonly heading: number;
  /** World-space velocity, u/s. */
  readonly linearVelocity: Vec2;
  /** rad/s; positive turns clockwise seen from above. */
  readonly angularVelocity: number;
}

/** Locomotion's own state (e.g. the engaged gear) as plain numbers, for determinism checks. */
export type LocomotionSnapshot = Readonly<Record<string, number>>;

/** The velocities a vehicle should have after this tick's drive forces. */
export interface Velocities {
  readonly linear: Vec2;
  readonly angular: number;
}

/**
 * How a vehicle turns a command into motion (architecture.md §4). Tracks,
 * legs or hover differ only here; `Vehicle`, controllers and collision don't
 * change.
 *
 * Returns velocities rather than moving the vehicle: physics (Rapier) moves it,
 * and contacts (walls, other tanks) can change those velocities before the
 * next tick.
 *
 * Implementations may keep state between ticks (a gearbox), so each vehicle
 * gets its own instance; `snapshot()` exposes that state.
 */
export interface Locomotion {
  step(command: VehicleCommand, motion: MotionState, dt: number): Velocities;
  snapshot(): LocomotionSnapshot;
}
