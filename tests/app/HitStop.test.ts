import { describe, expect, it } from 'vitest';
import { HitStop } from '../../src/app/HitStop';

describe('HitStop', () => {
  it('freezes for the given time, then lets go', () => {
    const stop = new HitStop(true);
    stop.trigger(0.06);
    expect(stop.frozen).toBe(true);
    stop.update(0.05);
    expect(stop.frozen).toBe(true);
    stop.update(0.02);
    expect(stop.frozen).toBe(false);
  });

  it('a second kill during a freeze does not shorten it', () => {
    const stop = new HitStop(true);
    stop.trigger(0.06);
    stop.update(0.03);
    stop.trigger(0.01);
    stop.update(0.02);
    expect(stop.frozen).toBe(true);
  });

  it('does nothing when switched off (?hitstop=off)', () => {
    const stop = new HitStop(false);
    stop.trigger(0.06);
    expect(stop.frozen).toBe(false);
  });
});
