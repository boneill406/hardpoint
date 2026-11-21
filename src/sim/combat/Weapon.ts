import { HeatLimiter } from './limiters/HeatLimiter';
import type { FireLimiter, LimiterStatus } from './limiters/FireLimiter';
import { ReloadLimiter } from './limiters/ReloadLimiter';
import type { LimiterDef, WeaponDef } from './WeaponDef';

/**
 * One gun (architecture.md §3): its def plus the limiters that gate it. Fires
 * only when every limiter allows, then tells them all it fired. Where the shot
 * goes is the mount's and the vehicle's business, not the weapon's.
 */
export class Weapon {
  private readonly limiters: readonly FireLimiter[];

  constructor(readonly def: WeaponDef) {
    if (def.limiters.length === 0) {
      throw new RangeError(`Weapon "${def.name}" needs at least one limiter`);
    }
    this.limiters = def.limiters.map(createLimiter);
  }

  /** Advances every limiter by one tick, before this tick's `tryFire`. */
  update(dt: number, triggerHeld: boolean): void {
    for (const limiter of this.limiters) {
      limiter.update(dt, triggerHeld);
    }
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
  }
}
