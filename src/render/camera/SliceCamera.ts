import { TargetCamera, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

/** Pitch above the ground plane: between isometric (~35°) and top-down (90°). */
const ELEVATION_RAD = (58 * Math.PI) / 180;
/** Distance from the camera to the point it looks at, in units. */
const DISTANCE = 34;
/** Vertical field of view. Narrow, so the high angle reads with little perspective distortion. */
const FOV_RAD = 0.75;

/**
 * The slice's high-angle camera (GDD §7). It looks "north" (+z) from behind and
 * above its target, so the player's start at the bottom of the arena faces up-screen.
 * Smoothed follow arrives in M2-5; for now it is aimed at a fixed point.
 */
export class SliceCamera {
  readonly camera: TargetCamera;

  constructor(scene: Scene) {
    this.camera = new TargetCamera('slice-camera', Vector3.Zero(), scene);
    this.camera.fov = FOV_RAD;
    this.camera.minZ = 1;
    this.camera.maxZ = 200;
  }

  /** Places the camera at the fixed high-angle offset from `target` and aims at it. */
  lookAt(target: Vector3): void {
    const offset = new Vector3(
      0,
      DISTANCE * Math.sin(ELEVATION_RAD),
      -DISTANCE * Math.cos(ELEVATION_RAD),
    );
    this.camera.position = target.add(offset);
    this.camera.setTarget(target);
  }
}
