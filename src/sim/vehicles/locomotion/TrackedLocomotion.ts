import { approach, clamp } from '../../core/scalar';
import { Vec2 } from '../../core/Vec2';
import type { TrackedLocomotionDef } from '../VehicleDef';
import type { VehicleCommand } from '../VehicleCommand';
import type { Locomotion, LocomotionSnapshot, MotionState, Velocities } from './Locomotion';

/** Below this forward speed (u/s) the tank counts as stopped, so it can shift gear. */
const STOPPED_SPEED = 0.05;
/** Absorbs float error when summing tick lengths into the shift time (12 × 1/60 ≠ 0.2 exactly). */
const SHIFT_EPSILON = 1e-9;

type Gear = 1 | -1;

/**
 * Tank-style driving: throttle along the hull, turn in place or while moving
 * (GDD §3, M2 plan D1/D3).
 *
 * Traction-limited: each tick, velocity only moves *toward* the commanded
 * velocity, by at most what the engine (forward/back), brakes, or track grip
 * (sideways) can change in one tick. That gives the acceleration ramp, and once
 * physics adds contacts it means a stronger tank out-pushes a weaker one: each
 * tank can only fight back as hard as its own limits allow.
 *
 * Gearbox: asking for the opposite direction brakes to a stop, sits still for
 * `shiftTime`, then engages. Releasing the throttle doesn't shift, so stopping
 * and pulling away the same way is immediate. This keeps the gear, so one
 * instance per vehicle (`createVehicle` makes one each).
 */
export class TrackedLocomotion implements Locomotion {
  private gear: Gear = 1;
  /** Seconds spent stopped while waiting to engage the other gear. */
  private shiftElapsed = 0;

  constructor(private readonly def: TrackedLocomotionDef) {}

  step(command: VehicleCommand, motion: MotionState, dt: number): Velocities {
    const forward = Vec2.fromHeading(motion.heading);
    const right = forward.rotate(Math.PI / 2);

    const newForward = this.stepForwardSpeed(
      command.throttle,
      motion.linearVelocity.dot(forward),
      dt,
    );

    // Tracks resist sliding sideways (from turning, or being shoved), up to their grip.
    const sideSpeed = motion.linearVelocity.dot(right);
    const newSide = approach(sideSpeed, 0, this.def.grip * dt);

    const targetTurn = clamp(command.turn, -1, 1) * this.def.turnRate;
    const turnRamp = (this.def.turnRate / this.def.turnAccelTime) * dt;
    const newAngular = approach(motion.angularVelocity, targetTurn, turnRamp);

    return {
      linear: forward.scale(newForward).add(right.scale(newSide)),
      angular: newAngular,
    };
  }

  snapshot(): LocomotionSnapshot {
    return { gear: this.gear, shiftElapsed: this.shiftElapsed };
  }

  /** Throttle → new speed along the hull, through the gearbox. */
  private stepForwardSpeed(throttle: number, currentSpeed: number, dt: number): number {
    const target = this.targetSpeed(throttle);
    const wanted = Math.sign(target);

    if (wanted !== 0 && wanted !== this.gear) {
      const braked = approach(currentSpeed, 0, this.brakeRate() * dt);
      if (Math.abs(braked) > STOPPED_SPEED) {
        this.shiftElapsed = 0;
        return braked;
      }
      this.shiftElapsed += dt;
      if (this.shiftElapsed + SHIFT_EPSILON < this.def.shiftTime) {
        return 0;
      }
      // Engaged: pull away from a standstill this same tick.
      this.gear = wanted > 0 ? 1 : -1;
      this.shiftElapsed = 0;
      return approach(0, target, this.forwardRate(0, target) * dt);
    }

    this.shiftElapsed = 0;
    return approach(currentSpeed, target, this.forwardRate(currentSpeed, target) * dt);
  }

  /** Throttle → signed speed along the hull; reverse is slower than forward. */
  private targetSpeed(throttle: number): number {
    const t = clamp(throttle, -1, 1);
    const factor = t >= 0 ? 1 : this.def.reverseFactor;
    return t * this.def.topSpeed * factor;
  }

  /** Engine rate when speeding up in the same direction; brake rate when slowing or reversing. */
  private forwardRate(current: number, target: number): number {
    const speedingUp = current * target >= 0 && Math.abs(target) > Math.abs(current);
    return speedingUp ? this.def.topSpeed / this.def.accelTime : this.brakeRate();
  }

  private brakeRate(): number {
    return this.def.topSpeed / this.def.stopTime;
  }
}
