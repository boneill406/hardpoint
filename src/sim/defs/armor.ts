import { degToRad } from '../core/angles';
import type { ArmorDef } from '../combat/ArmorDef';

// Armor tuning (GDD §3, §5). Player and insurgent share one profile in the slice.

/**
 * front ×0.65, side ×1.0, rear ×1.25, ±45° arcs. With the cannon's 50 damage an
 * insurgent (60 health) takes 2 front, 2 side or 1 rear hit (GDD §5).
 */
export const TANK_ARMOR: ArmorDef = {
  front: 0.65,
  side: 1.0,
  rear: 1.25,
  frontArc: degToRad(45),
  rearArc: degToRad(45),
  faceRule: 'direction',
};
