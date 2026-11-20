import { TargetCamera, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';

/** How the camera looks at the ground. Compared in play with `?cam=` (M2-5). */
export interface CameraPreset {
  /** Pitch above the ground plane, radians: isometric ≈ 35°, top-down = 90°. */
  readonly elevation: number;
  /** Distance from the camera to the point it follows, u. */
  readonly distance: number;
  /** Vertical field of view, radians. Narrow keeps the high angle low on perspective distortion. */
  readonly fov: number;
}

const DEG = Math.PI / 180;

export const CAMERA_PRESETS = {
  /** First guess (M0-3, T-19): lower angle, further out; shows most of the arena. */
  slice: { elevation: 58 * DEG, distance: 34, fov: 0.75 },
  /** The prototype's camera (`game.js`: offset (0, 23, 3.2), 38° FOV): steep and close. */
  proto: { elevation: Math.atan2(23, 3.2), distance: Math.hypot(23, 3.2), fov: 38 * DEG },
} as const satisfies Record<string, CameraPreset>;

export type CameraPresetName = keyof typeof CAMERA_PRESETS;

/**
 * Follow speed (1/s) of the exponential ease toward the target, from the
 * prototype: the gap closes by 1 − e^(−3.2·dt) each frame, the same at any
 * frame rate. Lags a little behind the tank so its movement reads on screen.
 */
const FOLLOW_RATE = 3.2;

/** The part of the ground plane the camera may show (the arena plus its walls). */
export interface GroundBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** How far the visible ground extends from the focus point, in each direction (u, all ≥ 0). */
interface ViewExtents {
  readonly left: number;
  readonly right: number;
  readonly near: number;
  readonly far: number;
}

/**
 * The slice's high-angle camera (GDD §7). It looks "north" (+z) from behind and
 * above its focus, so the player's start at the bottom of the arena faces
 * up-screen. The focus eases after the player (M2-5) and is clamped so the
 * view never shows the void beyond the arena walls.
 */
export class SliceCamera {
  readonly camera: TargetCamera;
  private focus: Vec2 | undefined;
  private extents: ViewExtents = { left: 0, right: 0, near: 0, far: 0 };

  constructor(
    scene: Scene,
    private readonly preset: CameraPreset,
    private readonly bounds: GroundBounds,
  ) {
    this.camera = new TargetCamera('slice-camera', Vector3.Zero(), scene);
    this.camera.fov = preset.fov;
    this.camera.minZ = 1;
    this.camera.maxZ = 200;
  }

  /**
   * Measures which patch of ground the screen shows around the focus. Must be
   * called once the canvas has its size, and again after every resize (the
   * aspect ratio changes the width). `groundAt` maps a canvas pixel to the ground.
   */
  measureView(
    width: number,
    height: number,
    groundAt: (x: number, y: number) => Vec2 | undefined,
  ): void {
    this.place(Vec2.ZERO);
    // Picking uses cached matrices; force them up to date for the new position and aspect.
    this.camera.getViewMatrix(true);
    this.camera.getProjectionMatrix(true);
    const corners = [
      groundAt(0, 0),
      groundAt(width, 0),
      groundAt(0, height),
      groundAt(width, height),
    ].filter((point): point is Vec2 => point !== undefined);
    this.extents = {
      left: Math.max(0, ...corners.map((p) => -p.x)),
      right: Math.max(0, ...corners.map((p) => p.x)),
      near: Math.max(0, ...corners.map((p) => -p.z)),
      far: Math.max(0, ...corners.map((p) => p.z)),
    };
    if (this.focus !== undefined) {
      this.place(this.focus);
    }
  }

  /**
   * Eases the focus toward `target` (the followed tank's drawn position) and
   * places the camera. The first call snaps, so the game doesn't open with a pan.
   */
  follow(target: Vec2, frameSeconds: number): void {
    const desired = this.clampToBounds(target);
    if (this.focus === undefined) {
      this.focus = desired;
    } else {
      const ease = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, frameSeconds));
      this.focus = this.focus.lerp(desired, ease);
    }
    this.place(this.focus);
  }

  /**
   * Moves a focus point so the visible ground stays inside the bounds. If the
   * view is wider (or deeper) than the bounds, centres it on that axis instead.
   */
  private clampToBounds(point: Vec2): Vec2 {
    const { left, right, near, far } = this.extents;
    const { minX, maxX, minZ, maxZ } = this.bounds;
    return new Vec2(
      clampAxis(point.x, minX + left, maxX - right),
      clampAxis(point.z, minZ + near, maxZ - far),
    );
  }

  /** Puts the camera at the preset's offset behind and above `focus`, looking at it. */
  private place(focus: Vec2): void {
    const { elevation, distance } = this.preset;
    const target = toBabylonPosition(focus);
    const offset = new Vector3(0, distance * Math.sin(elevation), -distance * Math.cos(elevation));
    this.camera.position = target.add(offset);
    this.camera.setTarget(target);
  }
}

/** Clamps to [low, high], or returns the midpoint when the range is inverted (view larger than bounds). */
function clampAxis(value: number, low: number, high: number): number {
  if (low > high) {
    return (low + high) / 2;
  }
  return Math.min(high, Math.max(low, value));
}
