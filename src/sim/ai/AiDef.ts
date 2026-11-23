/**
 * How an AI-driven tank behaves, as plain data (M4 plan D17, CLAUDE.md rule
 * 8). A harder or more cautious enemy is a new `AiDef`, not new code. Values
 * live in `src/sim/defs/ai.ts`. The engagement fields join in M4-4b.
 */
export interface AiDef {
  readonly driving: DrivingDef;
}

/** Following a path (M4 plan D4) and getting unstuck (D7). Distances in u, times in s, angles in rad. */
export interface DrivingDef {
  /** Steer toward the point this far ahead along the path. */
  readonly lookAhead: number;
  /** Turn input reaches full at this heading error. */
  readonly fullTurnAngle: number;
  /** Beyond this heading error, stop and turn in place. */
  readonly turnInPlaceAngle: number;
  /** Start slowing this far from the end of the path. */
  readonly slowRadius: number;
  /** Throttle never drops below this while slowing (so it still arrives). */
  readonly minThrottle: number;
  /** Close enough to the end of the path to stop. */
  readonly arriveRadius: number;
  readonly stuck: StuckDef;
}

export interface StuckDef {
  /** How long a stretch of trying to move is judged over (whole ticks). */
  readonly window: number;
  /** Moving less than this over a window counts as stuck... */
  readonly minDistance: number;
  /** ...unless the hull turned at least this much. */
  readonly minTurn: number;
  /** How long to back off when stuck (whole ticks). */
  readonly reverseTime: number;
  /** After this many back-offs without reaching the goal, give up on it. */
  readonly maxAttempts: number;
}
