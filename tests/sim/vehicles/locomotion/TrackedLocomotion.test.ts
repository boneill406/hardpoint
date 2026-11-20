import { describe, expect, it } from 'vitest';
import { TICK_SECONDS } from '../../../../src/sim/core/time';
import { Vec2 } from '../../../../src/sim/core/Vec2';
import type { MotionState } from '../../../../src/sim/vehicles/locomotion/Locomotion';
import { TrackedLocomotion } from '../../../../src/sim/vehicles/locomotion/TrackedLocomotion';
import type { VehicleCommand } from '../../../../src/sim/vehicles/VehicleCommand';
import type { TrackedLocomotionDef } from '../../../../src/sim/vehicles/VehicleDef';
import { drive, TEST_LOCOMOTION } from '../testVehicles';

// TEST_LOCOMOTION: top 10 u/s, reverse ×0.5, 0.5 s to top speed (20 u/s²),
// 0.25 s to stop (40 u/s²), 0.2 s gear shift (12 ticks), turn 2 rad/s with a
// 0.1 s ramp, grip 40 u/s².

const AT_REST: MotionState = { heading: 0, linearVelocity: Vec2.ZERO, angularVelocity: 0 };

/** One locomotion instance (it keeps gear state) plus the motion it produces, stepped tick by tick. */
class Driver {
  readonly locomotion: TrackedLocomotion;
  motion: MotionState;
  /** Forward speed after each tick, for checking pauses and ramps. */
  readonly speeds: number[] = [];

  constructor(def: TrackedLocomotionDef = TEST_LOCOMOTION, start: MotionState = AT_REST) {
    this.locomotion = new TrackedLocomotion(def);
    this.motion = start;
  }

  run(command: VehicleCommand, ticks: number): this {
    for (let i = 0; i < ticks; i++) {
      const velocities = this.locomotion.step(command, this.motion, TICK_SECONDS);
      this.motion = {
        heading: this.motion.heading + velocities.angular * TICK_SECONDS,
        linearVelocity: velocities.linear,
        angularVelocity: velocities.angular,
      };
      this.speeds.push(this.forwardSpeed);
    }
    return this;
  }

  get forwardSpeed(): number {
    return this.motion.linearVelocity.dot(Vec2.fromHeading(this.motion.heading));
  }

  get sideSpeed(): number {
    return this.motion.linearVelocity.dot(Vec2.fromHeading(this.motion.heading + Math.PI / 2));
  }
}

/** Number of ticks at exactly zero speed in a run of speeds. */
function ticksStopped(speeds: readonly number[]): number {
  return speeds.filter((speed) => speed === 0).length;
}

describe('TrackedLocomotion', () => {
  describe('throttle', () => {
    it('reaches top speed after the acceleration time, not before', () => {
      expect(new Driver().run(drive(1), 29).forwardSpeed).toBeLessThan(10);
      expect(new Driver().run(drive(1), 30).forwardSpeed).toBeCloseTo(10, 9);
    });

    it('never exceeds top speed', () => {
      expect(new Driver().run(drive(1), 300).forwardSpeed).toBeCloseTo(10, 9);
    });

    it('half throttle settles at half top speed', () => {
      expect(new Driver().run(drive(0.5), 120).forwardSpeed).toBeCloseTo(5, 9);
    });

    it('full reverse is capped at the reverse factor', () => {
      expect(new Driver().run(drive(-1), 120).forwardSpeed).toBeCloseTo(-5, 9);
    });

    it('releasing the throttle at top speed stops within the stop time', () => {
      const driver = new Driver().run(drive(1), 60);
      expect(driver.run(drive(0), 14).forwardSpeed).toBeGreaterThan(0);
      expect(driver.run(drive(0), 1).forwardSpeed).toBeCloseTo(0, 9);
      expect(driver.run(drive(0), 60).forwardSpeed).toBe(0);
    });

    it('clamps out-of-range throttle to full', () => {
      expect(new Driver().run(drive(3), 120).forwardSpeed).toBeCloseTo(10, 9);
    });
  });

  describe('gear shift', () => {
    it('forward to reverse: brakes to a stop, sits still for the shift time, then reverses', () => {
      const driver = new Driver().run(drive(1), 60);
      driver.speeds.length = 0;
      driver.run(drive(-1), 15 + 12 + 30);

      // 15 ticks braking (10 u/s at 40 u/s²), 11 ticks fully stopped, engaging on the 12th.
      expect(driver.speeds[14]).toBeCloseTo(0, 9);
      expect(ticksStopped(driver.speeds)).toBe(11);
      expect(driver.speeds[26]).toBeLessThan(0);
      expect(driver.forwardSpeed).toBeCloseTo(-5, 9);
    });

    it('reverse to forward pauses the same way', () => {
      const driver = new Driver().run(drive(-1), 60);
      driver.speeds.length = 0;
      driver.run(drive(1), 60);
      expect(ticksStopped(driver.speeds)).toBe(11);
    });

    it('selecting reverse from a standstill after driving forward still shifts', () => {
      const driver = new Driver().run(drive(1), 60).run(drive(0), 60);
      driver.speeds.length = 0;
      driver.run(drive(-1), 12);
      expect(ticksStopped(driver.speeds)).toBe(11);
      expect(driver.forwardSpeed).toBeLessThan(0);
    });

    it('releasing the throttle does not shift: pulling away the same way is immediate', () => {
      const driver = new Driver().run(drive(1), 60).run(drive(0), 60);
      driver.speeds.length = 0;
      driver.run(drive(1), 1);
      expect(driver.forwardSpeed).toBeGreaterThan(0);
    });

    it('easing off without changing direction never pauses', () => {
      const driver = new Driver().run(drive(1), 60);
      driver.speeds.length = 0;
      driver.run(drive(0.3), 60);
      expect(ticksStopped(driver.speeds)).toBe(0);
      expect(driver.forwardSpeed).toBeCloseTo(3, 9);
    });

    it('a shift time of 0 changes direction without a pause', () => {
      const driver = new Driver({ ...TEST_LOCOMOTION, shiftTime: 0 }).run(drive(1), 60);
      driver.speeds.length = 0;
      driver.run(drive(-1), 30);
      expect(ticksStopped(driver.speeds)).toBe(0);
    });

    it('snapshot reports the engaged gear and shift progress', () => {
      const driver = new Driver();
      expect(driver.locomotion.snapshot()).toEqual({ gear: 1, shiftElapsed: 0 });
      driver.run(drive(-1), 5);
      expect(driver.locomotion.snapshot()).toEqual({ gear: 1, shiftElapsed: 5 * TICK_SECONDS });
      driver.run(drive(-1), 7);
      expect(driver.locomotion.snapshot()).toEqual({ gear: -1, shiftElapsed: 0 });
    });
  });

  describe('turning', () => {
    it('positive turn ramps to the turn rate and turns clockwise (heading increases)', () => {
      expect(new Driver().run(drive(0, 1), 5).motion.angularVelocity).toBeLessThan(2);
      const turning = new Driver().run(drive(0, 1), 6).motion;
      expect(turning.angularVelocity).toBeCloseTo(2, 9);
      expect(turning.heading).toBeGreaterThan(0);
    });

    it('pivots in place with no throttle', () => {
      const pivoted = new Driver().run(drive(0, 1), 60).motion;
      expect(pivoted.heading).toBeGreaterThan(1.5);
      expect(pivoted.linearVelocity.length()).toBe(0);
    });

    it('stops turning when the turn input is released', () => {
      const driver = new Driver().run(drive(0, 1), 30).run(drive(0, 0), 6);
      expect(driver.motion.angularVelocity).toBeCloseTo(0, 9);
    });
  });

  describe('grip', () => {
    it('sideways sliding decays at the grip limit', () => {
      // Heading +z, sliding sideways (+x) at 5 u/s; grip removes 40/60 u/s per tick.
      const sliding: MotionState = { ...AT_REST, linearVelocity: new Vec2(5, 0) };
      expect(new Driver(TEST_LOCOMOTION, sliding).run(drive(0), 1).sideSpeed).toBeCloseTo(
        5 - 40 / 60,
        9,
      );
      expect(new Driver(TEST_LOCOMOTION, sliding).run(drive(0), 8).sideSpeed).toBe(0);
    });

    it('holds a full-speed turn: velocity follows the hull with little sideways slip', () => {
      const driver = new Driver().run(drive(1), 60).run(drive(1, 1), 60);
      expect(Math.abs(driver.sideSpeed)).toBeLessThan(0.5);
      expect(driver.forwardSpeed).toBeCloseTo(10, 0);
    });
  });
});
