import type { ShakeOffset } from './CameraShake';
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

/** The arena the camera frames: its outer wall edges and how tall the walls are. */
export interface GroundBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Wall height (u): the walls' top edges must fit on screen too, not just their bases. */
  readonly edgeHeight: number;
}

/** Maps a canvas pixel to the point it shows on the horizontal plane at `height`. */
export type ScreenToPlane = (x: number, y: number, height: number) => Vec2 | undefined;

/** How far the view reaches from the focus point (u, all ≥ 0), as used for clamping. */
interface ViewExtents {
  /** Half-width of the bottom (near, narrow) edge of the view, on the ground. */
  readonly halfWidth: number;
  /** Behind the focus to the bottom edge, at wall-top height. */
  readonly near: number;
  /** Ahead of the focus to the top edge, at wall-top height. */
  readonly far: number;
}

/**
 * The slice's high-angle camera (GDD §7). It looks "north" (+z) from behind and
 * above its focus, so the player's start at the bottom of the arena faces
 * up-screen. The focus eases after the player (M2-5) and is clamped to frame
 * the arena: the camera can travel until a wall's top edge reaches the screen
 * edge, so every wall and corner can come into view. A tilted camera sees a
 * trapezoid, wider at the top, so near the side walls the top corners show
 * ground beyond the arena (ArenaView draws terrain there, never void).
 */
const NO_SHAKE: ShakeOffset = { x: 0, y: 0 };

export class SliceCamera {
  readonly camera: TargetCamera;
  private focus: Vec2 | undefined;
  private extents: ViewExtents = { halfWidth: 0, near: 0, far: 0 };

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
   * Measures how far the view reaches around the focus. Call once the canvas
   * has its size and again after every resize (the aspect ratio changes the
   * width). Sideways reach uses the narrow bottom edge, so the bottom corners
   * can be reached; up and down use wall-top height, so whole walls fit.
   */
  measureView(width: number, height: number, pointAt: ScreenToPlane): void {
    this.place(Vec2.ZERO);
    // Picking uses cached matrices; force them up to date for the new position and aspect.
    this.camera.getViewMatrix(true);
    this.camera.getProjectionMatrix(true);
    const wallTop = this.bounds.edgeHeight;
    const bottomLeft = pointAt(0, height, 0);
    const bottomRight = pointAt(width, height, 0);
    const bottomAtWallTop = pointAt(width / 2, height, wallTop);
    const topAtWallTop = pointAt(width / 2, 0, wallTop);
    this.extents = {
      halfWidth: Math.min(-(bottomLeft?.x ?? 0), bottomRight?.x ?? 0),
      near: Math.max(0, -(bottomAtWallTop?.z ?? 0)),
      far: Math.max(0, topAtWallTop?.z ?? 0),
    };
    if (this.focus !== undefined) {
      this.place(this.focus);
    }
  }

  /** The next `follow` snaps instead of easing (a new run: don't pan across the arena). */
  reset(): void {
    this.focus = undefined;
  }

  /**
   * Eases the focus toward `target` (the followed tank's drawn position) and
   * places the camera. The first call snaps, so the game doesn't open with a pan.
   */
  follow(target: Vec2, frameSeconds: number, shake: ShakeOffset = NO_SHAKE): void {
    const desired = this.clampToBounds(target);
    if (this.focus === undefined) {
      this.focus = desired;
    } else {
      const ease = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, frameSeconds));
      this.focus = this.focus.lerp(desired, ease);
    }
    // Shake (M6-1b) nudges the view after clamping, so it shakes against walls too.
    this.place(this.focus.add(new Vec2(shake.x, shake.y)));
  }

  /**
   * Keeps the focus where the screen edges stop at the arena edges. If the view
   * is larger than the arena on an axis, centres it on that axis instead.
   */
  private clampToBounds(point: Vec2): Vec2 {
    const { halfWidth, near, far } = this.extents;
    const { minX, maxX, minZ, maxZ } = this.bounds;
    return new Vec2(
      clampAxis(point.x, minX + halfWidth, maxX - halfWidth),
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
