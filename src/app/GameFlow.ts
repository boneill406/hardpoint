import type { RunOutcome } from '../sim/modes/GameMode';

/**
 * Where the app is (M5-4, plan D8). `ending` is the short beat after the run
 * is decided (the destruction moment, or "VICTORY"), while the sim still runs.
 */
export type FlowState = 'title' | 'playing' | 'paused' | 'ending' | 'summary';

/** Seconds of real time between the run ending and the summary (plan D7). */
export interface FlowTiming {
  readonly defeatHold: number;
  readonly victoryHold: number;
}

export const FLOW_TIMING: FlowTiming = { defeatHold: 1.5, victoryHold: 2 };

/**
 * The app's screens as a small state machine, separate from the browser so the
 * transitions are unit-tested (`tests/app/`). It never touches the simulation:
 * the app asks `ticking` whether to advance it. Pausing is simply not ticking.
 *
 * ```
 * title ─start→ playing ⇄ paused
 *                  └─runEnded→ ending ─(hold)→ summary
 * restart / title: the app builds a new run, then newRun()
 * ```
 */
export class GameFlow {
  private current: FlowState;
  private holdLeft = 0;
  private ended: RunOutcome | undefined;

  constructor(
    initial: 'title' | 'playing',
    private readonly timing: FlowTiming = FLOW_TIMING,
  ) {
    this.current = initial;
  }

  get state(): FlowState {
    return this.current;
  }

  /** How the run ended, once it has. */
  get outcome(): RunOutcome | undefined {
    return this.ended;
  }

  /** Whether the simulation should advance this frame. */
  get ticking(): boolean {
    return this.current === 'playing' || this.current === 'ending';
  }

  /** Title → playing. Returns whether it changed anything. */
  start(): boolean {
    return this.move('title', 'playing');
  }

  /** Playing → paused (Esc / Start, or the window losing focus). */
  pause(): boolean {
    return this.move('playing', 'paused');
  }

  resume(): boolean {
    return this.move('paused', 'playing');
  }

  /** The sim reported `RunEnded`: hold for the moment, then the summary. */
  runEnded(outcome: RunOutcome): void {
    if (this.current !== 'playing' && this.current !== 'paused') {
      return;
    }
    this.ended = outcome;
    this.holdLeft = outcome === 'victory' ? this.timing.victoryHold : this.timing.defeatHold;
    this.current = 'ending';
  }

  /** Once per frame with real elapsed seconds: counts down the end hold. */
  update(frameSeconds: number): void {
    if (this.current !== 'ending') {
      return;
    }
    this.holdLeft -= Math.max(0, frameSeconds);
    // A tiny tolerance: frame times summed in floating point land just short of the hold.
    if (this.holdLeft <= 1e-9) {
      this.current = 'summary';
    }
  }

  /** A fresh run has been built (restart, or back to the title). */
  newRun(state: 'title' | 'playing'): void {
    this.current = state;
    this.ended = undefined;
    this.holdLeft = 0;
  }

  private move(from: FlowState, to: FlowState): boolean {
    if (this.current !== from) {
      return false;
    }
    this.current = to;
    return true;
  }
}
