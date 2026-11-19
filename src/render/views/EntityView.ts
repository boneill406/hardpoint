import type { Transform } from '../../sim/core/Transform';

/**
 * The Babylon side of one simulation entity. Views own their meshes and only
 * read sim state (CLAUDE.md rule 4); `RenderBridge` creates one per entity id
 * and disposes it when the entity leaves the world.
 */
export interface EntityView {
  /** Places the view at an (already interpolated) transform for this frame. */
  update(transform: Transform): void;
  /** Frees the view's meshes and materials. */
  dispose(): void;
}
