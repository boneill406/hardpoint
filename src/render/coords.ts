import { Vector3 } from '@babylonjs/core';
import { Vec2 } from '../sim/core/Vec2';

// The only place simulation coordinates become Babylon coordinates (CLAUDE.md
// conventions, architecture.md §9). The sim's ground plane (x, z) is Babylon's
// x/z plane with y up, so the mapping is direct.

/** Ground-plane point → Babylon world position, `height` units above the floor. */
export function toBabylonPosition(position: Vec2, height = 0): Vector3 {
  return new Vector3(position.x, height, position.z);
}

/**
 * Sim heading → Babylon `rotation.y`. Identical by design (plan D3): in Babylon's
 * left-handed, y-up space, `rotation.y = h` turns +z toward +x, exactly like the
 * sim's heading. Kept as a function so any future mismatch is fixed in one place.
 */
export function toBabylonRotationY(heading: number): number {
  return heading;
}

/** Babylon world position → ground-plane point (height dropped). Used for mouse aim. */
export function fromBabylonPosition(position: Vector3): Vec2 {
  return new Vec2(position.x, position.z);
}
