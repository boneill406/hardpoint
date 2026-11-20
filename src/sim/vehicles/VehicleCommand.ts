import { Vec2 } from '../core/Vec2';

/** Identifies a human player (1 in the slice; more with co-op). */
export type PlayerId = number;

/**
 * What a controller wants a vehicle to do this tick. Player input and AI both
 * produce this same shape, so `Vehicle` doesn't know who is driving it
 * (architecture.md §4, `Controller`).
 */
export interface VehicleCommand {
  /** -1 (full reverse) to 1 (full forward). */
  readonly throttle: number;
  /** -1 to 1; positive turns toward +x (clockwise seen from above), like heading. */
  readonly turn: number;
  /** Ground-plane point the turret should face. */
  readonly aimPoint: Vec2;
  readonly firePrimary: boolean;
  readonly fireSecondary: boolean;
}

/** No input: stand still, hold fire. A vehicle starts with this, and a player with no input gets it. */
export const IDLE_COMMAND: VehicleCommand = {
  throttle: 0,
  turn: 0,
  aimPoint: Vec2.ZERO,
  firePrimary: false,
  fireSecondary: false,
};
