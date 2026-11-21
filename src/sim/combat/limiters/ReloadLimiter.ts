import type { ReloadLimiterDef } from '../WeaponDef';
import type { FireLimiter, LimiterStatus } from './FireLimiter';

/** Absorbs float error when counting down in whole ticks (90 × 1/60 ≠ 1.5 exactly). */
const TIME_EPSILON = 1e-9;

/**
 * A fixed wait after each shot: the cannon's reload (1.5 s) or the machine
 * gun's cadence (0.1 s = 10 rounds/s). With whole-tick timings, shots land
 * exactly that many ticks apart.
 */
export class ReloadLimiter implements FireLimiter {
  private remaining = 0;

  constructor(private readonly def: ReloadLimiterDef) {}

  canFire(): boolean {
    return this.remaining <= TIME_EPSILON;
  }

  onFired(): void {
    this.remaining = this.def.seconds;
  }

  update(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }

  describe(): LimiterStatus {
    return { kind: 'reload', progress: 1 - this.remaining / this.def.seconds };
  }

  snapshot(): Readonly<Record<string, number>> {
    return { remaining: this.remaining };
  }
}
