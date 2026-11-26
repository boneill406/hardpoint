// Pure motion for spent shell casings (M6-2b): render-only, unit-tested.

/** A casing in flight or at rest, in Babylon axes (y up), u and u/s. */
export interface CasingState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  /** Floor bounces so far. */
  readonly bounces: number;
  /** On the floor and still: it no longer moves. */
  readonly resting: boolean;
}

export interface CasingPhysics {
  /** Downward acceleration, u/s² (positive). */
  readonly gravity: number;
  /** Fraction of vertical speed kept on each bounce. */
  readonly restitution: number;
  /** Fraction of horizontal speed kept on each bounce. */
  readonly friction: number;
  /** Bounces before it settles (Brendan: two). */
  readonly maxBounces: number;
  /** Height of its centre lying on the floor (its radius). */
  readonly restHeight: number;
}

/**
 * One step of a casing's flight: falls under gravity, bounces off the floor
 * (losing speed each time) up to `maxBounces` times, then settles where it
 * lands. Never goes below the floor.
 */
export function stepCasing(state: CasingState, dt: number, physics: CasingPhysics): CasingState {
  if (state.resting) {
    return state;
  }
  const vy = state.vy - physics.gravity * dt;
  const next = {
    ...state,
    x: state.x + state.vx * dt,
    y: state.y + vy * dt,
    z: state.z + state.vz * dt,
    vy,
  };
  if (next.y > physics.restHeight || vy > 0) {
    return next;
  }
  if (state.bounces >= physics.maxBounces) {
    return { ...next, y: physics.restHeight, vx: 0, vy: 0, vz: 0, resting: true };
  }
  return {
    ...next,
    y: physics.restHeight,
    vy: -vy * physics.restitution,
    vx: next.vx * physics.friction,
    vz: next.vz * physics.friction,
    bounces: state.bounces + 1,
  };
}

/** Opacity of a casing `age` s after ejection: solid for `lie` s, then fading out over `fade` s. */
export function casingOpacity(age: number, lie: number, fade: number): number {
  if (age < lie) {
    return 1;
  }
  return Math.max(0, 1 - (age - lie) / fade);
}

/**
 * Which way (yaw, radians; Babylon's: 0 = +z, positive toward +x) a casing
 * should lie once it settles, given the direction its long axis points as it
 * lands: the same way, flattened onto the floor, so settling never jumps to an
 * unrelated angle. A casing landing exactly upright keeps `fallback`.
 */
export function lyingYaw(axis: { x: number; y: number; z: number }, fallback: number): number {
  if (Math.hypot(axis.x, axis.z) < 1e-6) {
    return fallback;
  }
  return Math.atan2(axis.x, axis.z);
}

/** 0..1 eased progress of settling into lying flat (fast start, gentle finish). */
export function settleEase(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}
