// Angle helpers. All angles are radians and follow the heading convention in
// architecture.md §9 (0 = +z, positive turns toward +x).

const TAU = Math.PI * 2;

/** For defs: the GDD states angles in degrees, the simulation works in radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Wraps any angle into [-π, π). Headings accumulate past ±π as vehicles keep
 * turning; wrapping keeps them comparable and stops them growing without bound.
 */
export function wrapAngle(angle: number): number {
  return angle - TAU * Math.floor((angle + Math.PI) / TAU);
}

/**
 * Signed shortest turn from `from` to `to`, in [-π, π). Positive means turn
 * toward +x (clockwise seen from above). Turret traverse and AI steering use this
 * so they never go the long way round.
 */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/**
 * Blends two angles along the shortest arc, so 170° → -170° passes through 180°
 * rather than sweeping back through 0°. Used to interpolate headings for rendering.
 */
export function lerpAngle(from: number, to: number, t: number): number {
  return wrapAngle(from + angleDelta(from, to) * t);
}
