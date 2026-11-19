import { wrapAngle } from '../core/angles';
import { Entity } from '../core/Entity';
import type { Transform } from '../core/Transform';
import { Vec2 } from '../core/Vec2';

export interface DebugMoverOptions {
  /** Units per second along its heading. */
  readonly speed: number;
  /** Radians per second; positive turns clockwise seen from above. */
  readonly turnRate: number;
}

/**
 * Temporary M1 test entity (plan D1): drives at a constant speed and turn rate
 * so the fixed-step loop and render interpolation can be seen and tested before
 * `Vehicle` exists. Deleted in M2.
 */
export class DebugMover extends Entity {
  constructor(
    transform: Transform,
    private readonly options: DebugMoverOptions,
  ) {
    super(transform);
  }

  /** Advances one fixed step of `dt` seconds: turn first, then move along the new heading. */
  step(dt: number): void {
    const { position, heading } = this.transform;
    const newHeading = wrapAngle(heading + this.options.turnRate * dt);
    const travel = Vec2.fromHeading(newHeading).scale(this.options.speed * dt);
    this.setTransform({ position: position.add(travel), heading: newHeading });
  }
}
