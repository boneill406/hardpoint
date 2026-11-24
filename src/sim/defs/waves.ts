import type { WaveSurvivalDef } from '../modes/WaveDef';
import { INSURGENT_AI } from './ai';
import { INSURGENT_TANK, PLAYER_TANK } from './vehicles';

// GDD §2 and M5 plan D2: five waves, 1 → 5 tanks, escalating by count, timing
// (together or staggered) and clustering (one gate or spread). Gates are
// picked per run. Starting values for tuning in play.

export const SLICE_WAVES: WaveSurvivalDef = {
  player: PLAYER_TANK,
  enemy: { vehicle: INSURGENT_TANK, ai: INSURGENT_AI },
  timing: { banner: 2, warning: 1, cleared: 1.5, breather: 5 },
  // Slots 2.4 u apart: two 1.6 u-wide hulls with 0.8 u between them.
  slots: { inset: 2.5, spacing: 2.4 },
  waves: [
    {
      // Basics.
      groups: [{ at: 0, count: 1, from: 'one-gate' }],
      repair: 0.2,
    },
    {
      // A second angle, with time to deal with the first.
      groups: [
        { at: 0, count: 1, from: 'one-gate' },
        { at: 4, count: 1, from: 'one-gate' },
      ],
      repair: 0.2,
    },
    {
      // A pair, then a flank.
      groups: [
        { at: 0, count: 2, from: 'one-gate' },
        { at: 5, count: 1, from: 'one-gate' },
      ],
      repair: 0.2,
    },
    {
      // Surrounded, then one more.
      groups: [
        { at: 0, count: 3, from: 'spread' },
        { at: 6, count: 1, from: 'one-gate' },
      ],
      repair: 0.2,
    },
    {
      // Two pushes and a straggler.
      groups: [
        { at: 0, count: 2, from: 'one-gate' },
        { at: 3, count: 2, from: 'one-gate' },
        { at: 7, count: 1, from: 'one-gate' },
      ],
      repair: 0,
    },
  ],
};
