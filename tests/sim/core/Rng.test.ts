import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/sim/core/Rng';

const SEED = 12345;
const SAMPLES = 10_000;

function sequence(rng: Rng, length: number): number[] {
  return Array.from({ length }, () => rng.next());
}

describe('Rng', () => {
  describe('determinism', () => {
    it('the same seed produces the same sequence', () => {
      expect(sequence(new Rng(SEED), 100)).toEqual(sequence(new Rng(SEED), 100));
    });

    it('different seeds produce different sequences', () => {
      expect(sequence(new Rng(SEED), 100)).not.toEqual(sequence(new Rng(SEED + 1), 100));
    });

    it('matches the reference mulberry32 output, so saved seeds keep replaying the same game', () => {
      // Values from the canonical mulberry32 implementation with seed 12345.
      expect(sequence(new Rng(SEED), 3)).toEqual([
        0.9797282677609473, 0.3067522644996643, 0.484205421525985,
      ]);
    });

    it('a restored state resumes the sequence identically', () => {
      const rng = new Rng(SEED);
      sequence(rng, 37);
      const saved = rng.getState();
      const expected = sequence(rng, 50);

      const restored = new Rng(999);
      restored.setState(saved);
      expect(sequence(restored, 50)).toEqual(expected);
    });

    it('rejects a non-integer seed instead of silently truncating it', () => {
      expect(() => new Rng(1.5)).toThrow(RangeError);
    });
  });

  describe('ranges', () => {
    it('next stays in [0, 1) over 10k samples', () => {
      const rng = new Rng(SEED);
      for (let i = 0; i < SAMPLES; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('range stays in [min, max) over 10k samples', () => {
      const rng = new Rng(SEED);
      for (let i = 0; i < SAMPLES; i++) {
        const value = rng.range(-2.5, 4);
        expect(value).toBeGreaterThanOrEqual(-2.5);
        expect(value).toBeLessThan(4);
      }
    });

    it('int stays in [min, max] and hits both ends over 10k samples', () => {
      const rng = new Rng(SEED);
      const seen = new Set<number>();
      for (let i = 0; i < SAMPLES; i++) {
        const value = rng.int(-3, 3);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(-3);
        expect(value).toBeLessThanOrEqual(3);
        seen.add(value);
      }
      expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    });

    it('int with min equal to max always returns that value', () => {
      const rng = new Rng(SEED);
      expect(rng.int(7, 7)).toBe(7);
    });

    it('int rejects reversed or fractional bounds', () => {
      const rng = new Rng(SEED);
      expect(() => rng.int(5, 1)).toThrow(RangeError);
      expect(() => rng.int(0, 2.5)).toThrow(RangeError);
    });
  });

  describe('chance', () => {
    it('chance(0) never fires and chance(1) always fires', () => {
      const rng = new Rng(SEED);
      for (let i = 0; i < 1000; i++) {
        expect(rng.chance(0)).toBe(false);
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('chance(0.25) fires about a quarter of the time over 10k samples', () => {
      const rng = new Rng(SEED);
      let hits = 0;
      for (let i = 0; i < SAMPLES; i++) {
        if (rng.chance(0.25)) hits++;
      }
      expect(hits / SAMPLES).toBeGreaterThan(0.23);
      expect(hits / SAMPLES).toBeLessThan(0.27);
    });
  });

  describe('pick', () => {
    it('only returns elements of the list, and eventually each of them', () => {
      const rng = new Rng(SEED);
      const items = ['crate', 'barrel', 'wall'] as const;
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const item = rng.pick(items);
        expect(items).toContain(item);
        seen.add(item);
      }
      expect(seen.size).toBe(items.length);
    });

    it('throws on an empty list', () => {
      expect(() => new Rng(SEED).pick([])).toThrow('non-empty');
    });
  });
});
