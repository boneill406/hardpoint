import { describe, expect, it } from 'vitest';
import { markOpacity, trackPoints } from '../../src/render/vfx/treadMath';
import { heatGlow } from '../../src/render/views/tank/tankMotion';

describe('trackPoints', () => {
  it('facing +z, the right track is toward +x and the left toward −x', () => {
    const { left, right } = trackPoints({ x: 0, z: 0 }, 0, 0.65);
    expect(right.x).toBeCloseTo(0.65, 9);
    expect(left.x).toBeCloseTo(-0.65, 9);
    expect(right.z).toBeCloseTo(0, 9);
  });

  it('facing +x (heading π/2), the right track is toward −z', () => {
    const { right } = trackPoints({ x: 2, z: 3 }, Math.PI / 2, 0.5);
    expect(right.x).toBeCloseTo(2, 9);
    expect(right.z).toBeCloseTo(2.5, 9);
  });
});

describe('markOpacity', () => {
  it('holds, then fades to nothing', () => {
    expect(markOpacity(1, 0.4, 3, 4)).toBe(0.4);
    expect(markOpacity(5, 0.4, 3, 4)).toBeCloseTo(0.2, 9);
    expect(markOpacity(8, 0.4, 3, 4)).toBe(0);
  });
});

describe('heatGlow', () => {
  it('no glow at low heat; dull red rising to orange at full heat', () => {
    expect(heatGlow(0.2)).toEqual([0, 0, 0]);
    const half = heatGlow(0.625);
    const full = heatGlow(1);
    expect(half[0]).toBeGreaterThan(half[1]);
    expect(full[0]).toBeCloseTo(1, 9);
    expect(full[1]).toBeGreaterThan(half[1]);
  });
});
