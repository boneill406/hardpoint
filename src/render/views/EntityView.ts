import type { Transform } from '../../sim/core/Transform';

/** Timing for one rendered frame. */
export interface FrameTiming {
  /** Real time since the last frame, for view-only animation that must run at any frame rate. */
  readonly seconds: number;
  /**
   * 0..1 between the last two ticks (1 with `?interp=off`), for views that
   * interpolate state beyond the transform (e.g. the turret heading).
   */
  readonly alpha: number;
}

/**
 * The Babylon side of one simulation entity. Views own their meshes and only
 * read sim state (CLAUDE.md rule 4); `RenderBridge` creates one per entity id
 * and disposes it when the entity leaves the world.
 */
export interface EntityView {
  /** Places the view at an (already interpolated) transform for this frame. */
  update(transform: Transform, frame: FrameTiming): void;
  /** Frees the view's meshes and materials. */
  dispose(): void;
}
