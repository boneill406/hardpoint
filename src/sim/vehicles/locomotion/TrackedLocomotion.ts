import { approach, clamp } from '../../core/scalar';
import { Vec2 } from '../../core/Vec2';
import type { TrackedLocomotionDef } from '../VehicleDef';
import type { VehicleCommand } from '../VehicleCommand';
import type { Locomotion, MotionState, Velocities } from './Locomotion';

/**
 * Tank-style driving: throttle along the hull, turn in place or while moving
 * (GDD §3, M2 plan D1/D3).
 *
 * Traction-limited: each tick, velocity only moves *toward* the commanded
 * velocity, by at most what the engine (forward/back), brakes, or track grip
 * (sideways) can change in one tick. That gives the acceleration ramp, and once
 * physics adds contacts it means a stronger tank out-pushes a weaker one: each
 * tank can only fight back as hard as its own limits allow.
 */
export class TrackedLocomotion implements Locomotion {
  constructor(private readonly def: TrackedLocomotionDef) {}

  step(command: VehicleCommand, motion: MotionState, dt: number): Velocities {
    const forward = Vec2.fromHeading(motion.heading);
    const right = forward.rotate(Math.PI / 2);

    const forwardSpeed = motion.linearVelocity.dot(forward);
    const targetSpeed = this.targetSpeed(command.throttle);
    const newForward = approach(
      forwardSpeed,
      targetSpeed,
      this.forwardRate(forwardSpeed, targetSpeed) * dt,
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

  /** Throttle → signed speed along the hull; reverse is slower than forward. */
  private targetSpeed(throttle: number): number {
    const t = clamp(throttle, -1, 1);
    const factor = t >= 0 ? 1 : this.def.reverseFactor;
    return t * this.def.topSpeed * factor;
  }

  /** Engine rate when speeding up in the same direction; brake rate when slowing or reversing. */
  private forwardRate(current: number, target: number): number {
    const speedingUp = current * target >= 0 && Math.abs(target) > Math.abs(current);
    const seconds = speedingUp ? this.def.accelTime : this.def.stopTime;
    return this.def.topSpeed / seconds;
  }
}
