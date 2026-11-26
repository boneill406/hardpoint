// Pure math for tread marks (M6-4): where each track touches the floor, and how a mark fades.

/** A point on the ground plane (sim x, z). */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * The centres of a tank's two tracks, `offset` u either side of its centre,
 * for a tank at `position` facing `heading` (sim convention: 0 = +z, +π/2 = +x,
 * so the right track is toward +x when facing +z).
 */
export function trackPoints(
  position: GroundPoint,
  heading: number,
  offset: number,
): { left: GroundPoint; right: GroundPoint } {
  // The right-hand direction is the heading turned a quarter clockwise.
  const rx = Math.sin(heading + Math.PI / 2);
  const rz = Math.cos(heading + Math.PI / 2);
  return {
    left: { x: position.x - rx * offset, z: position.z - rz * offset },
    right: { x: position.x + rx * offset, z: position.z + rz * offset },
  };
}

/** A mark's opacity `age` s after it was laid: full for `hold` s, then fading out over `fade` s. */
export function markOpacity(age: number, opacity: number, hold: number, fade: number): number {
  if (age < hold) {
    return opacity;
  }
  return Math.max(0, opacity * (1 - (age - hold) / fade));
}
