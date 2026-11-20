import { describe, expect, it } from 'vitest';
import { approach, clamp } from '../../../src/sim/core/scalar';

describe('clamp', () => {
  it('limits values to the range and leaves values inside it alone', () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.3, -1, 1)).toBe(0.3);
  });
});

describe('approach', () => {
  it('moves toward the target by at most maxDelta', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
  });

  it('never overshoots the target', () => {
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(1, 0, 3)).toBe(0);
  });

  it('stays put when already at the target', () => {
    expect(approach(4, 4, 3)).toBe(4);
  });
});
