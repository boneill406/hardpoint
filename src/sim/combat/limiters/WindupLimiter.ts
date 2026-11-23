import type { WindupLimiterDef } from '../WeaponDef';
import type { FireLimiter, LimiterStatus } from './FireLimiter';

/** Absorbs float error when counting up in whole ticks (18 × 1/60 ≠ 0.3 exactly). */
const TIME_EPSILON = 1e-9;

/**
 * The trigger must be held for `seconds` before the gun fires: the enemy
 * cannon's fire telegraph (GDD §5, M4 plan D11), and later a charge-up gun.
 * Releasing early cancels; each shot needs a fresh windup.
 *
 * `Weapon` only reports the trigger held here when its other limiters would
 * allow a shot, so the windup is always the last `seconds` before the shot,
 * never spent during a reload.
 */
export class WindupLimiter implements FireLimiter {
  private active = false;
  private elapsed = 0;

  constructor(private readonly def: WindupLimiterDef) {}

  /** True from the tick the windup starts until it fires or is released. */
  get windingUp(): boolean {
    return this.active;
  }

  canFire(): boolean {
    return this.active && this.elapsed + TIME_EPSILON >= this.def.seconds;
  }

  onFired(): void {
    this.active = false;
    this.elapsed = 0;
  }

  /** Starts at 0 on the first held tick, so the shot comes exactly `seconds` after it. */
  update(dt: number, triggerHeld: boolean): void {
    if (!triggerHeld) {
      this.active = false;
      this.elapsed = 0;
      return;
    }
    if (this.active) {
      this.elapsed += dt;
    } else {
      this.active = true;
      this.elapsed = 0;
    }
  }

  describe(): LimiterStatus {
    return {
      kind: 'windup',
      progress: Math.min(1, this.elapsed / this.def.seconds),
      active: this.active,
    };
  }

  snapshot(): Readonly<Record<string, number>> {
    return { active: this.active ? 1 : 0, elapsed: this.elapsed };
  }
}
