import type { AiDef } from '../ai/AiDef';
import type { VehicleDef } from '../vehicles/VehicleDef';

/**
 * A batch of enemies that arrives together (M5 plan D2). Which gate is picked
 * by the simulation's `Rng` each run, preferring gates not used yet this wave,
 * so the player can't learn the order.
 */
export interface SpawnGroupDef {
  /** Seconds after the wave's banner ends. */
  readonly at: number;
  /** Tanks that come out at once. */
  readonly count: number;
  /** `one-gate`: side by side at one gate (at most 2, its slots). `spread`: each from a different gate. */
  readonly from: 'one-gate' | 'spread';
  /** Use this gate instead of picking one (tutorial-style waves). Only with `one-gate`. */
  readonly gate?: string;
}

export interface WaveDef {
  readonly groups: readonly SpawnGroupDef[];
  /** Fraction of max armor repaired in the breather after this wave (GDD §4). */
  readonly repair: number;
}

/** Phase lengths in seconds; each must be a whole number of ticks. */
export interface WaveTimingDef {
  /** "WAVE n / 5" before the first group can arrive. */
  readonly banner: number;
  /** A group's gate glows this long before it emerges (M5-2). */
  readonly warning: number;
  /** "WAVE CLEARED" before the breather. */
  readonly cleared: number;
  /** Countdown between waves. */
  readonly breather: number;
}

/** Where tanks appear at a gate (u). */
export interface SpawnSlotsDef {
  /** How far inside the gate, so a tank (barrel included) clears the wall. */
  readonly inset: number;
  /** Centre-to-centre distance between a gate's two side-by-side slots. */
  readonly spacing: number;
}

/** Everything a wave-survival run is made of (rule 8: content is data). */
export interface WaveSurvivalDef {
  readonly player: VehicleDef;
  readonly enemy: { readonly vehicle: VehicleDef; readonly ai: AiDef };
  readonly timing: WaveTimingDef;
  readonly slots: SpawnSlotsDef;
  readonly waves: readonly WaveDef[];
}
