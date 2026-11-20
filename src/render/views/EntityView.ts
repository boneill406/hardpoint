import type { Transform } from '../../sim/core/Transform';

/**
 * The Babylon side of one simulation entity. Views own their meshes and only
 * read sim state (CLAUDE.md rule 4); `RenderBridge` creates one per entity id
 * and disposes it when the entity leaves the world.
 */
export interface EntityView {
  /**
   * Places the view at an (already interpolated) transform for this frame.
   * `frameSeconds` is real time since the last frame, for view-only animation
   * (tread scroll, suspension) that must run at the same speed at any frame rate.
   */
  update(transform: Transform, frameSeconds: number): void;
  /** Frees the view's meshes and materials. */
  dispose(): void;
}
