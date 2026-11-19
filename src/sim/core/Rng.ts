/**
 * Seeded pseudo-random numbers for the simulation (mulberry32). The sim never
 * calls `Math.random()` (ADR-0001): with one seeded source, the same seed and
 * command stream replay the same game, which makes tests and bugs reproducible.
 *
 * mulberry32 uses only 32-bit integer operations, so unlike trig (T-33) its
 * sequence is identical on every JS engine. The whole state is one uint32,
 * which makes `getState` / `setState` trivial for snapshots.
 */
export class Rng {
  private state: number;

  /** `seed` must be an integer; it is reduced to 32 bits, so negative seeds are fine. */
  constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new RangeError(`Rng seed must be an integer, got ${seed}`);
    }
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). Every other method is built on this one. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). For continuous values such as spread angles. */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max], both ends included, like rolling a die. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int needs integers with min <= max, got ${min}..${max}`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p` (0 = never, 1 = always). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** A uniformly chosen element. Throws on an empty list, which is always a caller bug. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Rng.pick needs a non-empty list');
    }
    // The index is always in bounds; the cast only drops noUncheckedIndexedAccess's `| undefined`.
    return items[this.int(0, items.length - 1)] as T;
  }

  /** The full generator state, for snapshots and determinism checks. */
  getState(): number {
    return this.state;
  }

  /** Restores a state from `getState`; the sequence resumes exactly where it was. */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
