import { describe, expect, it } from 'vitest';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { CONTACT_PREDICTION_DISTANCE } from '../../../src/sim/physics/RapierPhysicsWorld';
import { MAX_VEHICLE_SPEED } from '../../../src/sim/vehicles/VehicleDef';

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

  it('stays under the design speed cap that collision is sized for (T-66)', () => {
    expect(locomotion.topSpeed).toBeLessThanOrEqual(MAX_VEHICLE_SPEED);
  });

  it('moves less per tick than the physics contact prediction distance, so it cannot sink into walls', () => {
    expect(locomotion.topSpeed * TICK_SECONDS).toBeLessThan(CONTACT_PREDICTION_DISTANCE);
  });

  it('times everything in whole 60 Hz ticks (M3 plan D13)', () => {
    const timings = {
      accelTime: locomotion.accelTime,
      stopTime: locomotion.stopTime,
      shiftTime: locomotion.shiftTime,
      turnAccelTime: locomotion.turnAccelTime,
      turretSpinUp: def.turret.spinUpTime,
    };
    for (const [name, seconds] of Object.entries(timings)) {
      const ticks = seconds / TICK_SECONDS;
      expect(Math.abs(ticks - Math.round(ticks)), name).toBeLessThan(1e-9);
    }
  });

  it('is longer than it is wide, so the nose reads as the front', () => {
    expect(def.hull.length).toBeGreaterThan(def.hull.width);
  });
});
