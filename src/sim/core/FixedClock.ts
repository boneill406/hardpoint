import { TICK_SECONDS } from './time';

export interface FixedClockOptions {
  /** Length of one step in seconds. Defaults to the simulation tick (1/60 s). */
  readonly stepSeconds?: number;
  /** Most steps one `advance` may return; time beyond that is dropped. Defaults to 5. */
  readonly maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 5;

/**
 * Turns variable frame times into a whole number of fixed simulation steps,
 * plus `alpha` for render interpolation (the "fix your timestep" accumulator).
 *
 * It never reads a clock itself: the caller passes elapsed seconds. That keeps
 * it in the pure sim layer (no `performance.now()`, ADR-0001) and lets tests
 * feed exact frame times.
 *
 * After a long stall (tab in background, breakpoint), running every missed
 * step would take longer than a frame and fall further behind each frame (the
 * "spiral of death"). So at most `maxSteps` run and the rest of the backlog is
 * dropped: the game briefly runs in slow motion instead.
 */
export class FixedClock {
  private readonly stepSeconds: number;
  private readonly maxSteps: number;
  private accumulator = 0;

  constructor(options: FixedClockOptions = {}) {
    const { stepSeconds = TICK_SECONDS, maxSteps = DEFAULT_MAX_STEPS } = options;
    if (!(stepSeconds > 0)) {
      throw new RangeError(`FixedClock stepSeconds must be positive, got ${stepSeconds}`);
    }
    if (!Number.isInteger(maxSteps) || maxSteps < 1) {
      throw new RangeError(`FixedClock maxSteps must be a positive integer, got ${maxSteps}`);
    }
    this.stepSeconds = stepSeconds;
    this.maxSteps = maxSteps;
  }

  /**
   * Adds a frame's elapsed real time and returns how many simulation steps to
   * run now (0..maxSteps). Zero, negative or NaN elapsed time adds nothing, so a
   * glitchy timestamp can't run the simulation backwards.
   */
  advance(elapsedSeconds: number): number {
    if (!(elapsedSeconds > 0)) {
      return 0;
    }
    this.accumulator += elapsedSeconds;
    const dueSteps = Math.floor(this.accumulator / this.stepSeconds);
    // Consume every due step, including those beyond the cap; that is the dropped time.
    this.accumulator -= dueSteps * this.stepSeconds;
    return Math.min(dueSteps, this.maxSteps);
  }

  /**
   * How far (0..1) real time has progressed into the next, not yet simulated
   * step. The renderer draws `lerp(previous, current, alpha)`.
   */
  get alpha(): number {
    return this.accumulator / this.stepSeconds;
  }
}
