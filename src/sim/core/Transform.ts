import type { Vec2 } from './Vec2';

/**
 * Where an entity is and which way it faces on the ground plane. Immutable, like
 * `Vec2`: moving an entity replaces its transform, so a stored
 * `previousTransform` can never change underneath the renderer.
 */
export interface Transform {
  readonly position: Vec2;
  /** Radians; 0 faces +z, positive turns toward +x (architecture.md §9). */
  readonly heading: number;
}
