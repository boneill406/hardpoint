import { HeatLimiter } from './limiters/HeatLimiter';
import type { FireLimiter, LimiterStatus } from './limiters/FireLimiter';
import { ReloadLimiter } from './limiters/ReloadLimiter';
import { WindupLimiter } from './limiters/WindupLimiter';
import type { LimiterDef, WeaponDef } from './WeaponDef';

/**
 * One gun (architecture.md §3): its def plus the limiters that gate it. Fires
 * only when every limiter allows, then tells them all it fired. Where the shot
 * goes is the mount's and the vehicle's business, not the weapon's.
 */
export class Weapon {
  private readonly limiters: readonly FireLimiter[];
  private readonly windups: readonly WindupLimiter[];
  private readonly others: readonly FireLimiter[];
  private wasWindingUp = false;
  private firedThisTick = false;

  constructor(readonly def: WeaponDef) {
    if (def.limiters.length === 0) {
      throw new RangeError(`Weapon "${def.name}" needs at least one limiter`);
    }
    this.limiters = def.limiters.map(createLimiter);
    this.windups = this.limiters.filter((limiter) => limiter instanceof WindupLimiter);
    this.others = this.limiters.filter((limiter) => !(limiter instanceof WindupLimiter));
  }

  /**
   * Advances every limiter by one tick, before this tick's `tryFire`. Windups
   * advance last, and see the trigger as held only while every other limiter
   * would allow a shot, so a windup never overlaps a reload (M4-5).
   */
  update(dt: number, triggerHeld: boolean): void {
    this.wasWindingUp = this.windingUp;
    this.firedThisTick = false;
    for (const limiter of this.others) {
      limiter.update(dt, triggerHeld);
    }
    const ready = this.others.every((limiter) => limiter.canFire());
    for (const windup of this.windups) {
      windup.update(dt, triggerHeld && ready);
    }
  }

  /** True while a windup is running (the telegraph is showing). */
  get windingUp(): boolean {
    return this.windups.some((windup) => windup.windingUp);
  }

  /**
   * After this tick's `update` and `tryFire`: whether a windup began
   * (`started`) or ended without a shot (`cancelled`). The simulation turns
   * these into `ShotTelegraphed` / `TelegraphCancelled`.
   */
  telegraph(): 'started' | 'cancelled' | undefined {
    if (this.windingUp && !this.wasWindingUp) {
      return 'started';
    }
    if (this.wasWindingUp && !this.windingUp && !this.firedThisTick) {
      return 'cancelled';
    }
    return undefined;
  }

  /** Seconds a full windup takes (0 if the weapon has none). */
  get windupSeconds(): number {
    return this.def.limiters.reduce(
      (total, limiter) => (limiter.kind === 'windup' ? Math.max(total, limiter.seconds) : total),
      0,
    );
  }

  canFire(): boolean {
    return this.limiters.every((limiter) => limiter.canFire());
  }

  /** Fires if every limiter allows; returns whether it fired. */
  tryFire(): boolean {
    if (!this.canFire()) {
      return false;
    }
    for (const limiter of this.limiters) {
      limiter.onFired();
    }
    this.firedThisTick = true;
    return true;
  }

  /** Each limiter's state, for the HUD. */
  describe(): LimiterStatus[] {
    return this.limiters.map((limiter) => limiter.describe());
  }

  snapshot(): Readonly<Record<string, number>>[] {
    return this.limiters.map((limiter) => limiter.snapshot());
  }
}

function createLimiter(def: LimiterDef): FireLimiter {
  switch (def.kind) {
    case 'reload':
      return new ReloadLimiter(def);
    case 'heat':
      return new HeatLimiter(def);
    case 'windup':
      return new WindupLimiter(def);
  }
}
