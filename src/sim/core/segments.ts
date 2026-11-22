import type { Vec2 } from './Vec2';

// Closest distance between two line segments on the ground plane. Used for
// barrel-against-barrel checks, which need both barrels' current poses (the
// physics engine only knows where they were before this tick).

/** Closest distance between segment a0–a1 and segment b0–b1. */
export function segmentDistance(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): number {
  if (segmentsIntersect(a0, a1, b0, b1)) {
    return 0;
  }
  return Math.min(
    pointToSegment(a0, b0, b1),
    pointToSegment(a1, b0, b1),
    pointToSegment(b0, a0, a1),
    pointToSegment(b1, a0, a1),
  );
}

function pointToSegment(p: Vec2, s0: Vec2, s1: Vec2): number {
  const along = s1.sub(s0);
  const lengthSquared = along.lengthSquared();
  if (lengthSquared === 0) {
    return p.distanceTo(s0);
  }
  const t = Math.min(1, Math.max(0, p.sub(s0).dot(along) / lengthSquared));
  return p.distanceTo(s0.add(along.scale(t)));
}

/** True if the segments cross (strictly; touching endpoints count as distance 0 via `pointToSegment`). */
function segmentsIntersect(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean {
  const d1 = cross(b0, b1, a0);
  const d2 = cross(b0, b1, a1);
  const d3 = cross(a0, a1, b0);
  const d4 = cross(a0, a1, b1);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** z-component of (b − a) × (p − a) on the ground plane: which side of a→b `p` is on. */
function cross(a: Vec2, b: Vec2, p: Vec2): number {
  return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
}

/**
 * The centre line of a capsule that spans exactly `from`…`to` (rounded ends
 * included, as barrel colliders do): pulled in by `radius` at each end.
 */
export function capsuleAxis(from: Vec2, to: Vec2, radius: number): { from: Vec2; to: Vec2 } {
  const length = to.distanceTo(from);
  if (length <= 2 * radius) {
    const middle = from.lerp(to, 0.5);
    return { from: middle, to: middle };
  }
  const inset = radius / length;
  return { from: from.lerp(to, inset), to: from.lerp(to, 1 - inset) };
}
