import { describe, expect, it } from 'vitest';
import { telegraphSignFrame } from '../../src/ui/telegraphSign';

describe('telegraphSignFrame', () => {
  it('starts empty and is full exactly when the shot is due', () => {
    expect(telegraphSignFrame(0, 0.4).fill).toBe(0);
    expect(telegraphSignFrame(0.2, 0.4).fill).toBeCloseTo(0.5, 9);
    expect(telegraphSignFrame(0.4, 0.4).fill).toBe(1);
    expect(telegraphSignFrame(0.45, 0.4).fill).toBe(1);
  });

  it('pops in small, overshoots, and settles at normal size', () => {
    expect(telegraphSignFrame(0, 0.4).scale).toBeLessThan(1);
    expect(telegraphSignFrame(0.04, 0.4).scale).toBeGreaterThan(1);
    expect(telegraphSignFrame(0.2, 0.4).scale).toBe(1);
  });

  it('turns urgent for the last 30 % of the windup', () => {
    expect(telegraphSignFrame(0.27, 0.4).urgent).toBe(false);
    expect(telegraphSignFrame(0.29, 0.4).urgent).toBe(true);
  });

  it('expires shortly after the windup if no shot or cancel removed it', () => {
    expect(telegraphSignFrame(0.49, 0.4).expired).toBe(false);
    expect(telegraphSignFrame(0.51, 0.4).expired).toBe(true);
  });
});
