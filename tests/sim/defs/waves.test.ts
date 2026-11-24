import { describe, expect, it } from 'vitest';
import { MAX_WAVE } from '../../../src/app/debugParams';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { SLICE_WAVES } from '../../../src/sim/defs/waves';

function wholeTicks(seconds: number): boolean {
  const ticks = seconds / TICK_SECONDS;
  return Math.abs(ticks - Math.round(ticks)) < 1e-9;
}

// Invariants any wave tuning must keep (M5 plan D2), not the values themselves.
describe('SLICE_WAVES', () => {
  it('has five waves of 1 → 5 tanks (GDD §2), matching ?wave= range', () => {
    const counts = SLICE_WAVES.waves.map((wave) =>
      wave.groups.reduce((sum, group) => sum + group.count, 0),
    );
    expect(counts).toEqual([1, 2, 3, 4, 5]);
    expect(SLICE_WAVES.waves).toHaveLength(MAX_WAVE);
  });

  it('times every phase and group in whole ticks', () => {
    for (const seconds of Object.values(SLICE_WAVES.timing)) {
      expect(wholeTicks(seconds)).toBe(true);
    }
    for (const group of SLICE_WAVES.waves.flatMap((wave) => wave.groups)) {
      expect(wholeTicks(group.at)).toBe(true);
    }
  });

  it('only asks for groups the arena can place: ≤ 2 at one gate, ≤ one per gate when spread, named gates exist', () => {
    const gates = SLICE_ARENA.gates.map((gate) => gate.name);
    for (const group of SLICE_WAVES.waves.flatMap((wave) => wave.groups)) {
      expect(group.count).toBeGreaterThanOrEqual(1);
      expect(group.count).toBeLessThanOrEqual(group.from === 'one-gate' ? 2 : gates.length);
      if (group.gate !== undefined) {
        expect(group.from).toBe('one-gate');
        expect(gates).toContain(group.gate);
      }
    }
  });

  it('repairs between 0 and 100 % of max armor', () => {
    for (const wave of SLICE_WAVES.waves) {
      expect(wave.repair).toBeGreaterThanOrEqual(0);
      expect(wave.repair).toBeLessThanOrEqual(1);
    }
  });
});
