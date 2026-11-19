import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../src/sim/core/FixedClock';
import { TICK_SECONDS } from '../../../src/sim/core/time';

/** Feeds `frames` equal frames and returns the total steps run. */
function runFrames(clock: FixedClock, frames: number, frameSeconds: number): number {
  let steps = 0;
  for (let i = 0; i < frames; i++) {
    steps += clock.advance(frameSeconds);
  }
  return steps;
}

describe('FixedClock', () => {
  describe('stepping', () => {
    it('defaults to 60 Hz steps', () => {
      expect(TICK_SECONDS).toBe(1 / 60);
      expect(new FixedClock().advance(1 / 60)).toBe(1);
    });

    it('two 1/120 s frames make exactly one step', () => {
      const clock = new FixedClock();
      expect(clock.advance(1 / 120)).toBe(0);
      expect(clock.advance(1 / 120)).toBe(1);
    });

    it('a 30 fps frame runs two steps', () => {
      expect(new FixedClock().advance(1 / 30)).toBe(2);
    });

    it('at 144 fps, one second of frames simulates one second (steps + alpha)', () => {
      const clock = new FixedClock();
      const steps = runFrames(clock, 144, 1 / 144);
      // Float rounding can leave the 60th step as alpha ≈ 1; the total time is what matters.
      expect(steps + clock.alpha).toBeCloseTo(60, 9);
    });
  });

  describe('alpha', () => {
    it('is the leftover fraction of a step', () => {
      const clock = new FixedClock();
      clock.advance(1 / 120);
      expect(clock.alpha).toBeCloseTo(0.5, 12);
    });

    it('keeps the leftover after whole steps run', () => {
      const clock = new FixedClock();
      expect(clock.advance(2.25 * TICK_SECONDS)).toBe(2);
      expect(clock.alpha).toBeCloseTo(0.25, 9);
    });

    it('starts at 0', () => {
      expect(new FixedClock().alpha).toBe(0);
    });
  });

  describe('stalls', () => {
    it('a 2 s stall runs 5 steps and drops the rest', () => {
      const clock = new FixedClock();
      expect(clock.advance(2)).toBe(5);
      // The dropped backlog doesn't come back on the next normal frame.
      expect(clock.advance(1 / 60)).toBe(1);
    });

    it('keeps the fractional part of a stall, so alpha stays below 1', () => {
      const clock = new FixedClock();
      clock.advance(100.5 * TICK_SECONDS);
      expect(clock.alpha).toBeCloseTo(0.5, 6);
    });

    it('respects a custom step cap', () => {
      expect(new FixedClock({ maxSteps: 2 }).advance(1)).toBe(2);
    });
  });

  describe('bad elapsed time', () => {
    it('zero, negative or NaN elapsed time runs no steps and changes nothing', () => {
      const clock = new FixedClock();
      clock.advance(1 / 120);
      expect(clock.advance(0)).toBe(0);
      expect(clock.advance(-1)).toBe(0);
      expect(clock.advance(Number.NaN)).toBe(0);
      expect(clock.alpha).toBeCloseTo(0.5, 12);
    });

    it('rejects a non-positive step or a non-integer cap', () => {
      expect(() => new FixedClock({ stepSeconds: 0 })).toThrow(RangeError);
      expect(() => new FixedClock({ maxSteps: 0 })).toThrow(RangeError);
      expect(() => new FixedClock({ maxSteps: 2.5 })).toThrow(RangeError);
    });
  });
});
