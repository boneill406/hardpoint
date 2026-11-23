/**
 * A weapon as plain data (CLAUDE.md rule 8), in designer terms: seconds,
 * rounds, rates. Per-shot numbers are derived from these by the limiters.
 * Values live in `src/sim/defs/weapons.ts` (GDD §4, M3 plan).
 */
export interface WeaponDef {
  readonly name: string;
  /** Fits only hardpoints of this size (M3 plan D14). */
  readonly size: 'small' | 'large';
  readonly barrel: BarrelDef;
  /**
   * Muzzle offsets across the barrel's end (u, to the right). One for a single
   * barrel; a twin gun lists two and alternates between them shot by shot.
   */
  readonly muzzles: readonly { readonly right: number }[];
  /** Base damage per hit, before the target's armor multiplier. */
  readonly damage: number;
  readonly projectile: {
    /** u/s */
    readonly speed: number;
    /** Collision radius of the swept shot (u). */
    readonly radius: number;
    /** Seconds before an unobstructed shot disappears (whole ticks). */
    readonly lifetime: number;
    /** How the render layer draws it: a heavy shell or a bright tracer streak. */
    readonly look: 'shell' | 'tracer';
  };
  /** Full width of the random spread cone (rad); 0 = perfectly accurate. */
  readonly spread: number;
  /** Destroys crates in one hit (the cannon); otherwise crates just stop the shot. */
  readonly breaksCover: boolean;
  /** Every limiter must allow a shot (architecture.md §4). At least one. */
  readonly limiters: readonly LimiterDef[];
}

/** The physical gun barrel: what collides (M3-8b) and what the view draws. */
export interface BarrelDef {
  /** From the hardpoint to the muzzle (u). */
  readonly length: number;
  /** Half the barrel's widest point, muzzle brake included (u): its collision and clearance radius. */
  readonly radius: number;
  /** How the render layer draws it. */
  readonly look: 'tube-brake' | 'thin-tube';
  /** Whether the barrel is solid against walls, cover and tanks (M3-8b). */
  readonly collides: boolean;
}

export type LimiterDef = ReloadLimiterDef | HeatLimiterDef | WindupLimiterDef;

/** A fixed wait between shots: the cannon's reload, or a machine gun's cadence. */
export interface ReloadLimiterDef {
  readonly kind: 'reload';
  /** Seconds between shots (whole 60 Hz ticks, M3 plan D13). */
  readonly seconds: number;
}

/** Heat that builds per shot and locks the weapon out when full (GDD §4). */
export interface HeatLimiterDef {
  readonly kind: 'heat';
  /** Shots from cold to overheated. */
  readonly roundsToOverheat: number;
  /** Heat lost per second (full = 1) while the trigger is released or the weapon is locked out. */
  readonly coolPerSecond: number;
  /** After overheating, the weapon fires again once heat has fallen to this (0..1). */
  readonly rearmAt: number;
}

/** Hold the trigger this long before each shot: the enemy fire telegraph (M4 plan D11). */
export interface WindupLimiterDef {
  readonly kind: 'windup';
  /** Seconds of held trigger, counted only once the gun is otherwise ready (whole ticks). */
  readonly seconds: number;
}
