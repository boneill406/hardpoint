import { describe, expect, it } from 'vitest';
import {
  pitchTarget,
  stepPitchSpring,
  treadBlur,
  treadSpeeds,
  type SpringState,
} from '../../src/render/views/tank/tankMotion';

const HALF_SPACING = 0.6;

describe('treadSpeeds', () => {
  it('driving straight runs both tracks at the tank speed', () => {
    expect(treadSpeeds(7, 0, HALF_SPACING)).toEqual({ left: 7, right: 7 });
  });

  it('pivoting in place runs the tracks at exactly equal and opposite speeds', () => {
    const { left, right } = treadSpeeds(0, 2.3, HALF_SPACING);
    expect(left).toBeCloseTo(2.3 * HALF_SPACING, 12);
    expect(right).toBe(-left);
  });

  it('turning right (positive, clockwise) runs the left, outer track faster', () => {
    const { left, right } = treadSpeeds(5, 1, HALF_SPACING);
    expect(left).toBeGreaterThan(right);
    expect(left).toBeCloseTo(5.6, 12);
    expect(right).toBeCloseTo(4.4, 12);
  });

  it('turning left runs the right, outer track faster', () => {
    const { left, right } = treadSpeeds(5, -1, HALF_SPACING);
    expect(right).toBeGreaterThan(left);
  });

  it('a tank that is not moving has still tracks (e.g. pinned against a wall or being shoved)', () => {
    expect(treadSpeeds(0, 0, HALF_SPACING)).toEqual({ left: 0, right: 0 });
  });
});

describe('treadBlur', () => {
  const PERIOD = 0.4;

  it('keeps the pattern crisp while it moves under a quarter period per frame', () => {
    // Full speed (7 u/s) at 60 fps: 0.117 u per frame, 0.29 of a period: barely any blur.
    expect(treadBlur(0, 1 / 60, PERIOD)).toBe(0);
    expect(treadBlur(5, 1 / 60, PERIOD)).toBe(0);
    expect(treadBlur(7, 1 / 60, PERIOD)).toBeLessThan(0.25);
  });

  it('blurs fully before the pattern could appear to run backwards (half a period per frame)', () => {
    // Full speed at 20 fps: 0.35 u per frame, 0.875 of a period.
    expect(treadBlur(7, 1 / 20, PERIOD)).toBe(1);
    expect(treadBlur(-7, 1 / 20, PERIOD)).toBe(1);
  });
});

describe('hull pitch', () => {
  it('speeding up tips the nose up (negative rotation.x) and braking dips it', () => {
    expect(pitchTarget(17.5)).toBeLessThan(0);
    expect(pitchTarget(-28)).toBeGreaterThan(0);
    expect(pitchTarget(0)).toBe(-0);
  });

  it('never pitches more than about 5°', () => {
    expect(Math.abs(pitchTarget(1000))).toBeLessThanOrEqual(0.09);
    expect(Math.abs(pitchTarget(-1000))).toBeLessThanOrEqual(0.09);
  });

  it('the spring settles on its target', () => {
    let state: SpringState = { angle: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) {
      state = stepPitchSpring(state, 0.05, 1 / 60);
    }
    expect(state.angle).toBeCloseTo(0.05, 4);
  });

  it('the spring overshoots once, so a gear change rocks the hull', () => {
    let state: SpringState = { angle: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      state = stepPitchSpring(state, 0.05, 1 / 60);
      peak = Math.max(peak, state.angle);
    }
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.05 * 1.5);
  });

  it('a long frame (a stall) cannot make the spring blow up', () => {
    const state = stepPitchSpring({ angle: 0, velocity: 0 }, 0.05, 2);
    expect(Math.abs(state.angle - 0.05)).toBeLessThan(0.01);
  });
});
