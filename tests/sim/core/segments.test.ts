import { describe, expect, it } from 'vitest';
import { capsuleAxis, segmentDistance } from '../../../src/sim/core/segments';
import { Vec2 } from '../../../src/sim/core/Vec2';

const v = (x: number, z: number): Vec2 => new Vec2(x, z);

describe('segmentDistance', () => {
  it('is zero for crossing segments', () => {
    expect(segmentDistance(v(-1, 0), v(1, 0), v(0, -1), v(0, 1))).toBe(0);
  });

  it('measures parallel segments side by side', () => {
    expect(segmentDistance(v(0, 0), v(2, 0), v(0, 0.5), v(2, 0.5))).toBeCloseTo(0.5, 12);
  });

  it('measures end to end along a line', () => {
    expect(segmentDistance(v(0, 0), v(1, 0), v(1.3, 0), v(2, 0))).toBeCloseTo(0.3, 12);
  });

  it('measures a tip near the middle of another segment', () => {
    expect(segmentDistance(v(0, 0), v(0, 1), v(-1, 1.2), v(1, 1.2))).toBeCloseTo(0.2, 12);
  });

  it('is symmetric', () => {
    const a = [v(0, 0), v(1, 2)] as const;
    const b = [v(3, 0), v(2, 5)] as const;
    expect(segmentDistance(a[0], a[1], b[0], b[1])).toBeCloseTo(
      segmentDistance(b[0], b[1], a[0], a[1]),
      12,
    );
  });
});

describe('capsuleAxis', () => {
  it('pulls a capsule spanning from…to in by its radius at each end', () => {
    const axis = capsuleAxis(v(0, 0), v(0, 2), 0.25);
    expect(axis.from.z).toBeCloseTo(0.25, 12);
    expect(axis.to.z).toBeCloseTo(1.75, 12);
  });

  it('collapses to the midpoint when the capsule is no longer than its diameter', () => {
    const axis = capsuleAxis(v(0, 0), v(0, 0.3), 0.2);
    expect(axis.from.z).toBeCloseTo(0.15, 12);
    expect(axis.to.z).toBeCloseTo(0.15, 12);
  });
});
