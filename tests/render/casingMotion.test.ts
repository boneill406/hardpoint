import { describe, expect, it } from 'vitest';
import { casingOpacity, stepCasing, type CasingState } from '../../src/render/vfx/casingMotion';

const PHYSICS = { gravity: 12, restitution: 0.45, friction: 0.6, maxBounces: 2, restHeight: 0.03 };

function run(state: CasingState, seconds: number): { final: CasingState; lowest: number } {
  let current = state;
  let lowest = Number.POSITIVE_INFINITY;
  for (let t = 0; t < seconds; t += 1 / 60) {
    current = stepCasing(current, 1 / 60, PHYSICS);
    lowest = Math.min(lowest, current.y);
  }
  return { final: current, lowest };
}

const thrown: CasingState = {
  x: 0,
  y: 0.9,
  z: 0,
  vx: 2,
  vy: 2.5,
  vz: 0,
  bounces: 0,
  resting: false,
};

describe('stepCasing', () => {
  it('bounces exactly twice, then settles on the floor', () => {
    const { final } = run(thrown, 3);
    expect(final.bounces).toBe(2);
    expect(final.resting).toBe(true);
    expect(final.y).toBe(PHYSICS.restHeight);
  });

  it('never sinks below the floor', () => {
    expect(run(thrown, 3).lowest).toBeGreaterThanOrEqual(PHYSICS.restHeight);
  });

  it('each bounce loses height and speed: it travels less after landing', () => {
    let state = thrown;
    for (let i = 0; i < 300 && state.bounces < 1; i++) state = stepCasing(state, 1 / 60, PHYSICS);
    const firstLanding = state.x;
    expect(state.vx).toBeCloseTo(2 * PHYSICS.friction, 9);
    const { final } = run(state, 3);
    expect(final.x - firstLanding).toBeLessThan(firstLanding);
  });

  it('a resting casing stays put', () => {
    const { final } = run(thrown, 3);
    expect(stepCasing(final, 1, PHYSICS)).toBe(final);
  });
});

describe('casingOpacity', () => {
  it('stays solid while it lies, then fades out', () => {
    expect(casingOpacity(2.9, 3, 1.5)).toBe(1);
    expect(casingOpacity(3.75, 3, 1.5)).toBeCloseTo(0.5, 9);
    expect(casingOpacity(4.5, 3, 1.5)).toBe(0);
  });
});
