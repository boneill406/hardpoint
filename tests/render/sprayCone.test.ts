import { describe, expect, it } from 'vitest';
import { sprayCone } from '../../src/render/vfx/sprayCone';

describe('sprayCone', () => {
  it('sprays out of the surface along its normal, leaning up by lift', () => {
    const [a, b] = sprayCone({ x: 1, z: 0 }, 0.3, 0);
    for (const d of [a, b]) {
      expect(d.x).toBeCloseTo(0.7, 9);
      expect(d.z).toBeCloseTo(0, 9);
      expect(d.y).toBeCloseTo(0.3, 9);
    }
  });

  it('spread widens it sideways (across the normal) on both sides', () => {
    const [a, b] = sprayCone({ x: 0, z: 2 }, 0, 0.5);
    expect(a.z).toBeCloseTo(1, 9);
    expect(b.z).toBeCloseTo(1, 9);
    expect(a.x).toBeCloseTo(0.5, 9);
    expect(b.x).toBeCloseTo(-0.5, 9);
  });

  it('with no normal it goes up and out all round', () => {
    const [a, b] = sprayCone({ x: 0, z: 0 }, 0.5, 1);
    expect(a.x).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(0);
    expect(Math.min(a.y, b.y)).toBeGreaterThan(0);
  });
});
