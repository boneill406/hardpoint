import { describe, expect, it } from 'vitest';
import { TICK_SECONDS } from '../../../../src/sim/core/time';
import { Vec2 } from '../../../../src/sim/core/Vec2';
import type { MotionState } from '../../../../src/sim/vehicles/locomotion/Locomotion';
import { TrackedLocomotion } from '../../../../src/sim/vehicles/locomotion/TrackedLocomotion';
import type { VehicleCommand } from '../../../../src/sim/vehicles/VehicleCommand';
import { drive, TEST_LOCOMOTION } from '../testVehicles';

// TEST_LOCOMOTION: top 10 u/s, reverse ×0.5, 0.5 s to top speed (20 u/s²),
// 0.25 s to stop (40 u/s²), turn 2 rad/s with a 0.1 s ramp, grip 40 u/s².

const AT_REST: MotionState = { heading: 0, linearVelocity: Vec2.ZERO, angularVelocity: 0 };

/** Steps locomotion for `ticks`, turning the heading as it goes (as the vehicle would). */
function run(command: VehicleCommand, ticks: number, start: MotionState = AT_REST): MotionState {
  const locomotion = new TrackedLocomotion(TEST_LOCOMOTION);
  let motion = start;
  for (let i = 0; i < ticks; i++) {
    const velocities = locomotion.step(command, motion, TICK_SECONDS);
    motion = {
      heading: motion.heading + velocities.angular * TICK_SECONDS,
      linearVelocity: velocities.linear,
      angularVelocity: velocities.angular,
    };
  }
  return motion;
}

function forwardSpeed(motion: MotionState): number {
  return motion.linearVelocity.dot(Vec2.fromHeading(motion.heading));
}

function sideSpeed(motion: MotionState): number {
  return motion.linearVelocity.dot(Vec2.fromHeading(motion.heading + Math.PI / 2));
}

describe('TrackedLocomotion', () => {
  describe('throttle', () => {
    it('reaches top speed after the acceleration time, not before', () => {
      expect(forwardSpeed(run(drive(1), 29))).toBeLessThan(10);
      expect(forwardSpeed(run(drive(1), 30))).toBeCloseTo(10, 9);
    });

    it('never exceeds top speed', () => {
      expect(forwardSpeed(run(drive(1), 300))).toBeCloseTo(10, 9);
    });

    it('half throttle settles at half top speed', () => {
      expect(forwardSpeed(run(drive(0.5), 120))).toBeCloseTo(5, 9);
    });

    it('full reverse is capped at the reverse factor', () => {
      expect(forwardSpeed(run(drive(-1), 120))).toBeCloseTo(-5, 9);
    });

    it('releasing the throttle at top speed stops within the stop time', () => {
      const cruising = run(drive(1), 60);
      expect(forwardSpeed(run(drive(0), 14, cruising))).toBeGreaterThan(0);
      expect(forwardSpeed(run(drive(0), 15, cruising))).toBeCloseTo(0, 9);
      expect(forwardSpeed(run(drive(0), 60, cruising))).toBe(0);
    });

    it('reversing from full speed brakes first, at the braking rate', () => {
      const cruising = run(drive(1), 60);
      expect(forwardSpeed(run(drive(-1), 15, cruising))).toBeCloseTo(0, 9);
      expect(forwardSpeed(run(drive(-1), 120, cruising))).toBeCloseTo(-5, 9);
    });

    it('clamps out-of-range throttle to full', () => {
      expect(forwardSpeed(run(drive(3), 120))).toBeCloseTo(10, 9);
    });
  });

  describe('turning', () => {
    it('positive turn ramps to the turn rate and turns clockwise (heading increases)', () => {
      expect(run(drive(0, 1), 5).angularVelocity).toBeLessThan(2);
      const turning = run(drive(0, 1), 6);
      expect(turning.angularVelocity).toBeCloseTo(2, 9);
      expect(turning.heading).toBeGreaterThan(0);
    });

    it('pivots in place with no throttle', () => {
      const pivoted = run(drive(0, 1), 60);
      expect(pivoted.heading).toBeGreaterThan(1.5);
      expect(pivoted.linearVelocity.length()).toBe(0);
    });

    it('stops turning when the turn input is released', () => {
      const turning = run(drive(0, 1), 30);
      expect(run(drive(0, 0), 6, turning).angularVelocity).toBeCloseTo(0, 9);
    });
  });

  describe('grip', () => {
    it('sideways sliding decays at the grip limit', () => {
      // Heading +z, sliding sideways (+x) at 5 u/s; grip removes 40/60 u/s per tick.
      const sliding: MotionState = { ...AT_REST, linearVelocity: new Vec2(5, 0) };
      expect(sideSpeed(run(drive(0), 1, sliding))).toBeCloseTo(5 - 40 / 60, 9);
      expect(sideSpeed(run(drive(0), 8, sliding))).toBe(0);
    });

    it('holds a full-speed turn: velocity follows the hull with little sideways slip', () => {
      const cruising = run(drive(1), 60);
      const turning = run(drive(1, 1), 60, cruising);
      expect(Math.abs(sideSpeed(turning))).toBeLessThan(0.5);
      expect(forwardSpeed(turning)).toBeCloseTo(10, 0);
    });
  });
});
