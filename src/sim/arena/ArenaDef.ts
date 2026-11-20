import type { Transform } from '../core/Transform';
import type { Vec2 } from '../core/Vec2';

/**
 * An arena layout as plain data (GDD §6, M2 plan D5). The slice has one, in
 * `src/sim/defs/arenas.ts`; Blender-authored arenas would produce the same shape.
 *
 * Coordinates are ground-plane units with the origin at the arena's centre;
 * +z is up-screen (architecture.md §9).
 */
export interface ArenaDef {
  readonly name: string;
  /** Playable floor, inside the walls. */
  readonly width: number;
  readonly depth: number;
  /** Walls sit just outside the playable floor. */
  readonly wall: { readonly thickness: number; readonly height: number };
  readonly playerStart: Transform;
  readonly gates: readonly GateDef[];
  /** Indestructible cover (props, `destructible: false`). */
  readonly pillars: readonly BoxDef[];
  /** Breakable cover (props, `destructible: true`; the cannon destroys them from M3). */
  readonly crates: readonly BoxDef[];
}

/**
 * An axis-aligned box on the ground plane. Rotated obstacles aren't needed for
 * the slice layout; add a heading when one is (T-62).
 */
export interface BoxDef {
  readonly center: Vec2;
  /** Size along x. */
  readonly width: number;
  /** Size along z. */
  readonly depth: number;
}

/**
 * Where enemies enter. Gates are markers on the wall's inner face, not holes:
 * walls stay continuous and spawning (M5) places tanks just inside, facing in.
 */
export interface GateDef {
  readonly name: string;
  /** On the inner face of a wall. */
  readonly position: Vec2;
  /** Facing into the arena. */
  readonly heading: number;
}
