import { describe, expect, it } from 'vitest';
import { Health } from '../../../src/sim/combat/Health';

describe('Health', () => {
  it('starts full and loses what it is dealt', () => {
    const health = new Health(60);
    expect(health.current).toBe(60);
    expect(health.damage(32.5)).toBe(32.5);
    expect(health.current).toBe(27.5);
    expect(health.depleted).toBe(false);
  });

  it('never goes below zero, and reports only what was actually lost', () => {
    const health = new Health(60);
    health.damage(50);
    expect(health.damage(62.5)).toBe(10);
    expect(health.current).toBe(0);
    expect(health.depleted).toBe(true);
  });

  it('ignores negative damage (no healing through hits)', () => {
    const health = new Health(60);
    expect(health.damage(-5)).toBe(0);
    expect(health.current).toBe(60);
  });

  it('rejects a non-positive max', () => {
    expect(() => new Health(0)).toThrow(RangeError);
  });
});
