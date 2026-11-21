import type { HeatLimiterDef } from '../WeaponDef';
import type { FireLimiter, LimiterStatus } from './FireLimiter';

/** Absorbs float error so 30 × (1/30) counts as full and 0.3 counts as re-armed. */
const EPSILON = 1e-9;

/**
 * Machine-gun heat (GDD §4): each shot adds 1 / `roundsToOverheat`; at full
 * heat the weapon locks out until it cools to `rearmAt`.
 *
 * Cooling happens while the trigger is released **or** while locked out. Not
 * while firing, so "30 rounds to overheat" is exact; but always when locked,
 * otherwise holding the trigger through an overheat would jam it forever.
 */
export class HeatLimiter implements FireLimiter {
  private heat = 0;
  private overheated = false;

  constructor(private readonly def: HeatLimiterDef) {}

  canFire(): boolean {
    return !this.overheated;
  }

  onFired(): void {
    this.heat += 1 / this.def.roundsToOverheat;
    if (this.heat >= 1 - EPSILON) {
      this.heat = 1;
      this.overheated = true;
    }
  }

  update(dt: number, triggerHeld: boolean): void {
    if (triggerHeld && !this.overheated) {
      return;
    }
    this.heat = Math.max(0, this.heat - this.def.coolPerSecond * dt);
    if (this.overheated && this.heat <= this.def.rearmAt + EPSILON) {
      this.overheated = false;
    }
  }

  describe(): LimiterStatus {
    return { kind: 'heat', heat: this.heat, overheated: this.overheated };
  }

  snapshot(): Readonly<Record<string, number>> {
    return { heat: this.heat, overheated: this.overheated ? 1 : 0 };
  }
}
