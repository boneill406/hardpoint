// Pure maths for firing effects (M6-2a): recoil, flash light, trail spacing.
// Render-only, unit-tested like `tankMotion.ts`.

/**
 * How far back (u, negative = toward the breech) a barrel sits `age` seconds
 * after firing: it snaps back by `kick` at once, then eases forward over
 * `returnTime`, fast at first and settling gently (a heavy gun on its recoil
 * spring).
 */
export function recoilOffset(age: number, kick: number, returnTime: number): number {
  if (age < 0 || age >= returnTime) {
    return 0;
  }
  const remaining = 1 - age / returnTime;
  return -kick * remaining * remaining;
}

/** Muzzle-flash light brightness (0..1) `age` seconds after the shot: full at once, gone by `duration`. */
export function flashIntensity(age: number, duration: number): number {
  if (age < 0 || age >= duration) {
    return 0;
  }
  return 1 - age / duration;
}

/** A point on the ground plane. */
export interface PlanePoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Evenly spaced points along a shell's path this frame, so its smoke trail
 * has no gaps however far it moved (at 90 u/s a shell crosses 1.5 u a frame).
 * `carry` is how far past the last point the previous frame ended; it is
 * returned updated, so spacing stays even across frames.
 */
export function pointsAlong(
  from: PlanePoint,
  to: PlanePoint,
  spacing: number,
  carry: number,
): { points: PlanePoint[]; carry: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const points: PlanePoint[] = [];
  if (length === 0 || spacing <= 0) {
    return { points, carry };
  }
  let at = spacing - carry;
  while (at <= length) {
    const t = at / length;
    points.push({ x: from.x + dx * t, z: from.z + dz * t });
    at += spacing;
  }
  return { points, carry: length - (at - spacing) };
}
