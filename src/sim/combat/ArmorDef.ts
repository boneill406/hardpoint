/** Which side of a hull a hit counts against (GDD §5). */
export type ArmorFace = 'front' | 'side' | 'rear';

/** Where a hit landed for damage: a hull face, or a gun barrel (M4-5, Brendan: barrels take damage). */
export type HitZone = ArmorFace | 'barrel';

/**
 * How a hit's face is decided (M3 plan D5). Both are built so Brendan can
 * compare them in play (`?armor=struck`) and keep one at the M3-5 check.
 * - `struck`: the face the shell actually hit, from the surface normal (the slice default, picked at M3).
 * - `direction`: where the shot came from relative to the hull.
 */
export type FaceRule = 'direction' | 'struck';

/**
 * Directional armor as plain data (CLAUDE.md rule 8). Values live in
 * `src/sim/defs/armor.ts`; `ArmorProfile` applies them.
 */
export interface ArmorDef {
  /** Damage multipliers by face: below 1 shrugs hits off, above 1 punishes flanking. */
  readonly front: number;
  readonly side: number;
  readonly rear: number;
  /**
   * Multiplier for a shot stopped by a gun barrel. The slice uses the front
   * value: barrels sit over the front, so a barrel hit counts as hitting armor.
   */
  readonly barrel: number;
  /** Half-width of the front arc around hull forward (rad); GDD: 45°. */
  readonly frontArc: number;
  /** Half-width of the rear arc around hull back (rad); GDD: 45°. */
  readonly rearArc: number;
  readonly faceRule: FaceRule;
}
