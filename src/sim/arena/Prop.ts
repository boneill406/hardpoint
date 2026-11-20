import { Entity } from '../core/Entity';
import type { Transform } from '../core/Transform';

export type PropKind = 'pillar' | 'crate';

/**
 * Static cover: pillars and crates (architecture.md §3, M2 plan D5). An entity,
 * unlike walls, so a crate can be destroyed in M3 through the normal
 * `World.remove` → `EntityDestroyed` path and the renderer drops its view.
 */
export class Prop extends Entity {
  constructor(
    transform: Transform,
    readonly kind: PropKind,
    /** Footprint along the prop's own x (width) and z (depth); also its collision box from M2-3. */
    readonly size: { readonly width: number; readonly depth: number },
    readonly destructible: boolean,
  ) {
    super(transform);
  }
}
