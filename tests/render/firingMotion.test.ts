import { describe, expect, it } from 'vitest';
import {
  emissionThisFrame,
  flashIntensity,
  hitFlash,
  pointsAlong,
  recoilOffset,
  scorchOpacity,
} from '../../src/render/vfx/firingMotion';

describe('recoilOffset', () => {
  it('snaps back by the full kick at once, then eases forward to rest', () => {
    expect(recoilOffset(0, 0.3, 0.25)).toBeCloseTo(-0.3, 9);
    expect(recoilOffset(0.125, 0.3, 0.25)).toBeCloseTo(-0.075, 9);
    expect(recoilOffset(0.25, 0.3, 0.25)).toBe(0);
  });

  it('returns fast at first: half the time in, it has recovered three quarters', () => {
    expect(recoilOffset(0.125, 1, 0.25) / recoilOffset(0, 1, 0.25)).toBeCloseTo(0.25, 9);
  });

  it('is at rest before a shot and long after', () => {
    expect(recoilOffset(-1, 0.3, 0.25)).toBe(0);
    expect(recoilOffset(5, 0.3, 0.25)).toBe(0);
  });
});

describe('flashIntensity', () => {
  it('starts full and fades linearly to nothing', () => {
    expect(flashIntensity(0, 0.08)).toBe(1);
    expect(flashIntensity(0.04, 0.08)).toBeCloseTo(0.5, 9);
    expect(flashIntensity(0.08, 0.08)).toBe(0);
  });
});

describe('pointsAlong', () => {
  it('spaces points evenly along the segment', () => {
    const { points, carry } = pointsAlong({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.3, 0);
    expect(points.map((p) => Math.round(p.x * 1000) / 1000)).toEqual([0.3, 0.6, 0.9]);
    expect(carry).toBeCloseTo(0.1, 9);
  });

  it('keeps the spacing even across frames using the carry', () => {
    const first = pointsAlong({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.3, 0);
    const second = pointsAlong({ x: 1, z: 0 }, { x: 2, z: 0 }, 0.3, first.carry);
    expect(second.points[0]?.x).toBeCloseTo(1.2, 9);
  });

  it('a short step emits nothing but remembers how far it went', () => {
    const { points, carry } = pointsAlong({ x: 0, z: 0 }, { x: 0, z: 0.1 }, 0.3, 0.05);
    expect(points).toEqual([]);
    expect(carry).toBeCloseTo(0.15, 9);
  });

  it('a standing shell emits nothing', () => {
    expect(pointsAlong({ x: 1, z: 1 }, { x: 1, z: 1 }, 0.3, 0).points).toEqual([]);
  });
});

describe('hitFlash', () => {
  it('is full on the hit and gone after the duration, fading fast', () => {
    expect(hitFlash(0, 0.12)).toBe(1);
    expect(hitFlash(0.06, 0.12)).toBeCloseTo(0.25, 9);
    expect(hitFlash(0.12, 0.12)).toBe(0);
  });
});

describe('emissionThisFrame', () => {
  it('emits whole particles and carries the rest, so the rate is exact over time', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const frame = emissionThisFrame(14, 1 / 60, carry);
      total += frame.count;
      carry = frame.carry;
    }
    expect(total).toBe(14);
  });

  it('at a slow frame rate it emits several at once', () => {
    expect(emissionThisFrame(14, 0.5, 0).count).toBe(7);
  });
});

describe('scorchOpacity', () => {
  it('holds full for half its time, then fades to nothing', () => {
    expect(scorchOpacity(0, 0.5, 20)).toBe(0.5);
    expect(scorchOpacity(10, 0.5, 20)).toBe(0.5);
    expect(scorchOpacity(15, 0.5, 20)).toBeCloseTo(0.25, 9);
    expect(scorchOpacity(20, 0.5, 20)).toBe(0);
  });
});
