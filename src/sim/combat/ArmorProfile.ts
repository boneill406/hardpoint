import { angleDelta } from '../core/angles';
import type { Vec2 } from '../core/Vec2';
import type { ArmorDef, ArmorFace, FaceRule } from './ArmorDef';

/** What the armor needs to know about one hit. */
export interface ArmorHit {
  /** The target's hull heading when hit. */
  readonly hullHeading: number;
  /** Which way the shot was travelling. */
  readonly shotHeading: number;
  /** Outward normal of the surface hit (from the sweep). */
  readonly normal: Vec2;
}

/**
 * Directional armor (architecture.md §3, GDD §5): picks the face a hit counts
 * against and its damage multiplier. Pure maths on headings, so the same hit
 * always lands on the same face (no mesh or physics lookups).
 */
export class ArmorProfile {
  constructor(readonly def: ArmorDef) {}

  /** The face a hit counts against, by `rule` (default: the def's). */
  faceOf(hit: ArmorHit, rule: FaceRule = this.def.faceRule): ArmorFace {
    const toward = rule === 'direction' ? hit.shotHeading + Math.PI : hit.normal.heading();
    return this.faceAt(angleDelta(hit.hullHeading, toward));
  }

  /**
   * The face covering `relative`: an angle from hull forward (rad, either
   * sign). Arc edges count as the front or rear ("within ±45°").
   */
  faceAt(relative: number): ArmorFace {
    const off = Math.abs(relative);
    if (off <= this.def.frontArc) {
      return 'front';
    }
    if (off >= Math.PI - this.def.rearArc) {
      return 'rear';
    }
    return 'side';
  }

  multiplier(face: ArmorFace): number {
    return this.def[face];
  }
}
