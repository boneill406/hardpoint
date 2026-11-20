import { describe, expect, it } from 'vitest';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';

// Invariants any tuning must keep, not the tuning values themselves (those change in playtests).
describe.each([PLAYER_TANK, INSURGENT_TANK])('$name def', (def) => {
  const { locomotion } = def;

  it('has positive mass, hull size and handling times', () => {
    const values = [
      def.mass,
      def.hull.length,
      def.hull.width,
      locomotion.topSpeed,
      locomotion.accelTime,
      locomotion.stopTime,
      locomotion.turnRate,
      locomotion.turnAccelTime,
    ];
    for (const value of values) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('reverses no faster than it drives forward', () => {
    expect(locomotion.reverseFactor).toBeGreaterThan(0);
    expect(locomotion.reverseFactor).toBeLessThanOrEqual(1);
  });

  it('has enough grip to hold a full-speed turn without sliding out', () => {
    // Turning at speed v and rate ω needs v·ω of sideways correction per second.
    expect(locomotion.grip).toBeGreaterThan(locomotion.topSpeed * locomotion.turnRate);
  });

  it('is longer than it is wide, so the nose reads as the front', () => {
    expect(def.hull.length).toBeGreaterThan(def.hull.width);
  });
});
