import type { TransformNode } from '@babylonjs/core';

/** The visible top run of one track: a repeating pattern that scrolls as the track turns. */
export interface TreadSurface {
  /** Distance (u) the track surface has travelled; positive = forward over the hull. */
  scrollTo(distance: number): void;
  /** 0 = crisp pattern, 1 = fully blurred (moving too fast to read without strobing). */
  setBlur(amount: number): void;
}

/**
 * The parts of a tank model that `TankView` animates. A model built from
 * primitives implements it now; a Blender/glTF model can later implement the
 * same interface by finding named nodes, without `TankView` changing.
 *
 * Node frames: +z is the tank's forward, y up, origin on the ground at the
 * hull centre (architecture.md §9).
 */
export interface TankModel {
  /** Placed at the tank's position and heading. */
  readonly root: TransformNode;
  /** Hull and everything on it, but not the tracks; pitches with acceleration. */
  readonly hull: TransformNode;
  /** Rotates to aim (M3). */
  readonly turret: TransformNode;
  /**
   * One node per fitted hardpoint (by id), origin at its muzzle tip (+z forward along the turret);
   * the barrel geometry extends backwards from it, so the drawn tip is the
   * sim's muzzle. Barrels are rigid (Brendan); sliding a node back is for
   * firing recoil (M6).
   */
  readonly guns: Readonly<Record<string, TransformNode>>;
  readonly leftTread: TreadSurface;
  readonly rightTread: TreadSurface;
  /** Half the distance between the track centrelines (u), for tread speeds. */
  readonly halfTrackSpacing: number;
  /** Length (u) of one repeat of the tread pattern. */
  readonly treadPeriod: number;
  /** 0 = normal, 1 = glowing white-hot: the hit flash (M6-1b). */
  setFlash(amount: number): void;
  /** 0 cold … 1 full: that gun's barrel glows with heat (M6-4). Adds to the hit flash. */
  setGunHeat(hardpoint: string, heat: number): void;
  dispose(): void;
}
