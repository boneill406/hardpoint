import { angleDelta, wrapAngle } from '../core/angles';
import type { Vec2 } from '../core/Vec2';
import type { TurretDef } from './VehicleDef';

/** Spin-up times are whole ticks; this absorbs float error when summing tick lengths. */
const TIME_EPSILON = 1e-9;

/** Turret state as plain numbers, for determinism checks. */
export interface TurretSnapshot {
  readonly heading: number;
  readonly targetHeading: number;
  readonly moving: number;
  readonly spinUpElapsed: number;
}

/**
 * A vehicle's turret (architecture.md §3, M3 plan D1). **Stabilised**: its
 * heading is in world terms, so turning the hull doesn't swing the gun; only
 * traverse does. Traverse waits a short spin-up, then turns at a fixed rate
 * the short way round, and snaps on once within a small angle. All behaviour
 * from the prototype, with round numbers.
 */
export class Turret {
  private current: number;
  private previous: number;
  private target: number;
  private moving = false;
  private spinUpElapsed = 0;

  constructor(
    private readonly def: TurretDef,
    initialHeading: number,
  ) {
    this.current = initialHeading;
    this.previous = initialHeading;
    this.target = initialHeading;
  }

  /** World heading (radians, architecture.md §9). */
  get heading(): number {
    return this.current;
  }

  /** Heading at the end of the previous tick, for render interpolation. */
  get previousHeading(): number {
    return this.previous;
  }

  /** Called with the vehicle's `saveTransform` at the start of each tick. */
  saveHeading(): void {
    this.previous = this.current;
  }

  /**
   * Turns toward `aimPoint` as seen from `position`. With no aim point, or one
   * too close to the tank, it keeps going for its last target.
   *
   * `canFace` (M3-8b) says whether the barrels would be clear at a heading; if
   * the full turn would put a barrel into something, the turret turns as far
   * as it can and **stalls** there, trying again next tick.
   */
  step(
    aimPoint: Vec2 | undefined,
    position: Vec2,
    dt: number,
    canFace: (heading: number) => boolean = () => true,
  ): void {
    if (aimPoint !== undefined) {
      const toAim = aimPoint.sub(position);
      if (toAim.length() >= this.def.minAimDistance) {
        this.target = toAim.heading();
      }
    }

    const delta = angleDelta(this.current, this.target);
    if (Math.abs(delta) <= this.def.snapAngle) {
      this.current = this.target;
      this.moving = false;
      this.spinUpElapsed = 0;
      return;
    }
    if (!this.moving) {
      this.spinUpElapsed += dt;
      if (this.spinUpElapsed + TIME_EPSILON < this.def.spinUpTime) {
        return;
      }
      this.moving = true;
    }
    const turn = Math.min(Math.abs(delta), this.def.traverseRate * dt);
    this.current = this.furthestClear(Math.sign(delta) * turn, canFace);
  }

  /**
   * The heading after turning by up to `turn`, as far as `canFace` allows.
   * Halving search: 5 steps get within 1/32 of a tick's turn of the obstacle.
   * If the barrels are already blocked here (e.g. the hull was shoved), any
   * turn is allowed so the turret can't get trapped.
   */
  private furthestClear(turn: number, canFace: (heading: number) => boolean): number {
    const full = wrapAngle(this.current + turn);
    if (canFace(full) || !canFace(this.current)) {
      return full;
    }
    let allowed = 0;
    let blocked = 1;
    for (let i = 0; i < 5; i++) {
      const middle = (allowed + blocked) / 2;
      if (canFace(wrapAngle(this.current + turn * middle))) {
        allowed = middle;
      } else {
        blocked = middle;
      }
    }
    return wrapAngle(this.current + turn * allowed);
  }

  snapshot(): TurretSnapshot {
    return {
      heading: this.current,
      targetHeading: this.target,
      moving: this.moving ? 1 : 0,
      spinUpElapsed: this.spinUpElapsed,
    };
  }
}
