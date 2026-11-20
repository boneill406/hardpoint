import { Vec2 } from '../core/Vec2';
import type { World } from '../core/World';
import type { ArenaDef, BoxDef } from './ArenaDef';
import { Prop } from './Prop';

/**
 * The arena's fixed structure, built from an `ArenaDef`: the four walls (not
 * entities: they never change) and the props (pillars, crates) it spawns into
 * the world. From M2-3 the walls and props get static colliders.
 */
export class Arena {
  /** Four wall boxes just outside the playable floor; corners overlap so there are no gaps. */
  readonly walls: readonly BoxDef[];

  constructor(readonly def: ArenaDef) {
    this.walls = wallBoxes(def);
  }

  /** Half the playable width (x) and depth (z): the floor spans ±halfWidth, ±halfDepth. */
  get halfWidth(): number {
    return this.def.width / 2;
  }

  get halfDepth(): number {
    return this.def.depth / 2;
  }

  /** True if `point` is on the playable floor (inside the walls). */
  contains(point: Vec2): boolean {
    return Math.abs(point.x) <= this.halfWidth && Math.abs(point.z) <= this.halfDepth;
  }

  /** Adds every pillar, then every crate, as `Prop` entities in def order (stable ids for determinism). */
  spawnProps(world: World): void {
    for (const box of this.def.pillars) {
      world.add(propFromBox(box, 'pillar', false));
    }
    for (const box of this.def.crates) {
      world.add(propFromBox(box, 'crate', true));
    }
  }
}

function propFromBox(box: BoxDef, kind: 'pillar' | 'crate', destructible: boolean): Prop {
  return new Prop(
    { position: box.center, heading: 0 },
    kind,
    { width: box.width, depth: box.depth },
    destructible,
  );
}

function wallBoxes(def: ArenaDef): BoxDef[] {
  const t = def.wall.thickness;
  const halfW = def.width / 2;
  const halfD = def.depth / 2;
  const outerWidth = def.width + 2 * t;
  return [
    { center: new Vec2(0, halfD + t / 2), width: outerWidth, depth: t },
    { center: new Vec2(0, -halfD - t / 2), width: outerWidth, depth: t },
    { center: new Vec2(halfW + t / 2, 0), width: t, depth: def.depth },
    { center: new Vec2(-halfW - t / 2, 0), width: t, depth: def.depth },
  ];
}
