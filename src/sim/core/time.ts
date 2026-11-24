// Simulation timing constants. The sim always advances in fixed ticks (CLAUDE.md
// rule 6), so every system that integrates over time uses this one step length.

/** Simulation ticks per second. */
export const TICK_RATE = 60;

/** Length of one simulation tick, in seconds. */
export const TICK_SECONDS = 1 / TICK_RATE;

/** Whole ticks for a duration in seconds (defs are checked to be whole ticks, so rounding only absorbs float noise). */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}
