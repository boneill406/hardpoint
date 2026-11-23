/** What a limiter tells the HUD (M3-6): a reload bar or a heat bar. */
export type LimiterStatus = ReloadStatus | HeatStatus | WindupStatus;

export interface ReloadStatus {
  readonly kind: 'reload';
  /** 0 just fired … 1 ready. */
  readonly progress: number;
}

export interface HeatStatus {
  readonly kind: 'heat';
  /** 0 cold … 1 full. */
  readonly heat: number;
  readonly overheated: boolean;
}

/** A windup in progress (M4-5): drives the fire telegraph. */
export interface WindupStatus {
  readonly kind: 'windup';
  /** 0 … 1 through the windup. */
  readonly progress: number;
  readonly active: boolean;
}

/**
 * One rule that can stop a weapon firing (architecture.md §4). A weapon fires
 * only when **all** its limiters allow, so new firing styles (ammo, burst,
 * charge-up) are new limiters, not new weapons.
 */
export interface FireLimiter {
  canFire(): boolean;
  /** The weapon fired this tick. */
  onFired(): void;
  /**
   * Advances time by one tick, before the weapon tries to fire. `triggerHeld`
   * lets heat-style limiters cool only while the player isn't firing.
   */
  update(dt: number, triggerHeld: boolean): void;
  describe(): LimiterStatus;
  /** Internal state as plain numbers, for determinism checks. */
  snapshot(): Readonly<Record<string, number>>;
}
