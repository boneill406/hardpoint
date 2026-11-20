import type { BoxDef } from '../../../src/sim/arena/ArenaDef';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import type { HullDef } from '../../../src/sim/vehicles/VehicleDef';

// Geometry helpers for collision tests: "treads never visibly enter obstacles"
// is checked by measuring how deep two oriented boxes overlap.

/**
 * Overlap we accept from the contact solver (u), under 1% of a hull length and
 * invisible on screen. Measured worst case is ~0.005 (M2-3a).
 */
export const TOLERANCE = 0.02;

/** An oriented rectangle on the ground plane. */
export interface Box {
  readonly center: Vec2;
  /** Half size along the box's own x (right) and z (forward). */
  readonly halfX: number;
  readonly halfZ: number;
  readonly heading: number;
}

export function hullBox(transform: Transform, hull: HullDef): Box {
  return {
    center: transform.position,
    halfX: hull.width / 2,
    halfZ: hull.length / 2,
    heading: transform.heading,
  };
}

export function obstacleBox(box: BoxDef): Box {
  return { center: box.center, halfX: box.width / 2, halfZ: box.depth / 2, heading: 0 };
}

/**
 * How far two oriented rectangles overlap: the smallest push that would separate
 * them (separating axis theorem), or 0 if they don't touch.
 */
export function penetration(a: Box, b: Box): number {
  const axes = [a, b].flatMap((box) => [
    Vec2.fromHeading(box.heading),
    Vec2.fromHeading(box.heading + Math.PI / 2),
  ]);
  const radius = (box: Box, axis: Vec2): number =>
    box.halfZ * Math.abs(Vec2.fromHeading(box.heading).dot(axis)) +
    box.halfX * Math.abs(Vec2.fromHeading(box.heading + Math.PI / 2).dot(axis));
  let depth = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const overlap = radius(a, axis) + radius(b, axis) - Math.abs(b.center.sub(a.center).dot(axis));
    if (overlap <= 0) {
      return 0;
    }
    depth = Math.min(depth, overlap);
  }
  return depth;
}

/** Seconds → ticks at 60 Hz. */
export const seconds = (s: number): number => Math.round(s * 60);
