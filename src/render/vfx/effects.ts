// Visual effects as data (M6 plan D1–D2). Sizes are for the game camera, about 30 px per u.
// the render-side twin of CLAUDE.md
// rule 8. Each burst effect is plain numbers; `Vfx` builds pooled Babylon
// particle systems from them. Tuning an effect means editing a value here.

/** RGBA, 0..1. */
export type Rgba = readonly [number, number, number, number];

/** Which generated texture a particle uses (`particleTextures.ts`). */
export type ParticleTexture = 'soft' | 'smoke' | 'spark';

/** A one-shot spray of particles from a point (an impact, a flash). */
export interface BurstEffectDef {
  readonly texture: ParticleTexture;
  /** Particles per burst. */
  readonly count: number;
  /** Seconds each particle lives (random between). */
  readonly lifetime: readonly [number, number];
  /** Starting size in u (random between). */
  readonly size: readonly [number, number];
  /** Size at the end of its life, × the starting size (smoke grows, sparks shrink). */
  readonly growth: number;
  /** Launch speed in u/s (random between). */
  readonly speed: readonly [number, number];
  /** How far the spray leans out of the surface (0) or up (1); see `sprayCone`. */
  readonly lift: number;
  /** Half-width of the spray, as a fraction of its direction (0 = a jet, 1 = ±45°). */
  readonly spread: number;
  /** Vertical acceleration, u/s² (negative falls). */
  readonly gravity: number;
  /** Colour at birth and at death (alpha 0 at death fades it out). */
  readonly colour: { readonly start: Rgba; readonly end: Rgba };
  /**
   * Fraction of its life a particle keeps its start colour before fading
   * (default 0: fades from birth). Smoke needs it: fading from birth, a puff
   * is invisible by the time it has grown, and reads as a dot.
   */
  readonly fadeFrom?: number;
  /** `add` glows (sparks, flashes); `alpha` is ordinary see-through (dust, smoke). */
  readonly blend: 'add' | 'alpha';
  /** Sparks stretch along their motion; everything else is a round billboard. */
  readonly stretched: boolean;
}

export type EffectName =
  | 'muzzleCannon'
  | 'muzzleMg'
  | 'muzzleSmoke'
  | 'flash'
  | 'sparks'
  | 'sparksSmall'
  | 'dust'
  | 'dustSmall'
  | 'chips'
  | 'woodDust'
  | 'splinters';

export const EFFECTS: Readonly<Record<EffectName, BurstEffectDef>> = {
  // Cannon muzzle flash (M6-2a): a short, hot tongue of fire thrown forward out of the brake.
  muzzleCannon: {
    texture: 'soft',
    count: 7,
    lifetime: [0.05, 0.09],
    size: [0.45, 0.8],
    growth: 1.5,
    speed: [3, 8],
    lift: 0.05,
    spread: 0.3,
    gravity: 0,
    colour: { start: [1, 0.85, 0.5, 1], end: [1, 0.4, 0.1, 0] },
    blend: 'add',
    stretched: false,
  },
  // MG muzzle flash: a small, quick spark of fire per round.
  muzzleMg: {
    texture: 'soft',
    count: 2,
    lifetime: [0.03, 0.05],
    size: [0.22, 0.32],
    growth: 1.3,
    speed: [2, 5],
    lift: 0.05,
    spread: 0.25,
    gravity: 0,
    colour: { start: [1, 0.85, 0.55, 1], end: [1, 0.5, 0.15, 0] },
    blend: 'add',
    stretched: false,
  },
  // The cannon's breath of smoke after the flash, drifting forward and up.
  muzzleSmoke: {
    texture: 'smoke',
    count: 5,
    lifetime: [0.4, 0.7],
    size: [0.3, 0.5],
    growth: 2,
    speed: [0.8, 2.2],
    lift: 0.25,
    spread: 0.5,
    gravity: 0.4,
    colour: { start: [0.75, 0.74, 0.7, 0.45], end: [0.6, 0.6, 0.58, 0] },
    fadeFrom: 0.3,
    blend: 'alpha',
    stretched: false,
  },
  // A hot white-yellow pop where a shell lands: the core of every shell impact.
  flash: {
    texture: 'soft',
    count: 1,
    lifetime: [0.07, 0.07],
    size: [1.3, 1.3],
    growth: 1.4,
    speed: [0, 0],
    lift: 0,
    spread: 0,
    gravity: 0,
    colour: { start: [1, 0.92, 0.7, 1], end: [1, 0.55, 0.2, 0] },
    blend: 'add',
    stretched: false,
  },
  // Shell on armour: a fan of bright sparks thrown off the plate, falling.
  sparks: {
    texture: 'spark',
    count: 22,
    lifetime: [0.15, 0.35],
    size: [0.14, 0.22],
    growth: 0.4,
    speed: [4, 9],
    lift: 0.35,
    spread: 0.9,
    gravity: -9,
    colour: { start: [1, 0.9, 0.6, 1], end: [1, 0.45, 0.1, 0] },
    blend: 'add',
    stretched: true,
  },
  // MG round on armour: a few small sparks.
  sparksSmall: {
    texture: 'spark',
    count: 6,
    lifetime: [0.08, 0.2],
    size: [0.1, 0.14],
    growth: 0.4,
    speed: [3, 6],
    lift: 0.3,
    spread: 0.9,
    gravity: -9,
    colour: { start: [1, 0.85, 0.55, 1], end: [1, 0.4, 0.1, 0] },
    blend: 'add',
    stretched: true,
  },
  // Shell on stone (walls, pillars): a grey puff that swells and settles.
  dust: {
    texture: 'smoke',
    count: 9,
    lifetime: [0.5, 0.9],
    size: [0.45, 0.75],
    growth: 2.2,
    speed: [0.6, 1.8],
    lift: 0.5,
    spread: 1,
    gravity: 0.3,
    colour: { start: [0.58, 0.56, 0.5, 0.55], end: [0.5, 0.48, 0.44, 0] },
    fadeFrom: 0.3,
    blend: 'alpha',
    stretched: false,
  },
  // MG round on stone or wood: a small puff.
  dustSmall: {
    texture: 'smoke',
    count: 3,
    lifetime: [0.3, 0.5],
    size: [0.22, 0.34],
    growth: 1.8,
    speed: [0.4, 1.2],
    lift: 0.5,
    spread: 1,
    gravity: 0.2,
    colour: { start: [0.58, 0.56, 0.5, 0.5], end: [0.5, 0.48, 0.44, 0] },
    fadeFrom: 0.3,
    blend: 'alpha',
    stretched: false,
  },
  // Dark grit thrown out of a stone impact, falling fast.
  chips: {
    texture: 'soft',
    count: 7,
    lifetime: [0.25, 0.45],
    size: [0.1, 0.15],
    growth: 1,
    speed: [3, 6],
    lift: 0.45,
    spread: 1,
    gravity: -14,
    colour: { start: [0.25, 0.24, 0.22, 1], end: [0.25, 0.24, 0.22, 0] },
    blend: 'alpha',
    stretched: false,
  },
  // Shell on a crate: brown dust.
  woodDust: {
    texture: 'smoke',
    count: 8,
    lifetime: [0.45, 0.8],
    size: [0.42, 0.7],
    growth: 2,
    speed: [0.6, 1.6],
    lift: 0.5,
    spread: 1,
    gravity: 0.2,
    colour: { start: [0.55, 0.42, 0.26, 0.55], end: [0.5, 0.4, 0.28, 0] },
    fadeFrom: 0.3,
    blend: 'alpha',
    stretched: false,
  },
  // Splinters out of a crate.
  splinters: {
    texture: 'soft',
    count: 6,
    lifetime: [0.3, 0.5],
    size: [0.11, 0.16],
    growth: 1,
    speed: [3, 5.5],
    lift: 0.5,
    spread: 1,
    gravity: -12,
    colour: { start: [0.62, 0.46, 0.26, 1], end: [0.62, 0.46, 0.26, 0] },
    blend: 'alpha',
    stretched: false,
  },
};

/** What a shot hit, for choosing its impact effect. */
export type ImpactSurface = 'metal' | 'stone' | 'wood';

/** The projectile's look: a cannon shell or an MG tracer (`ProjectileImpact.look`). */
export type ImpactLook = 'shell' | 'tracer';

const IMPACTS: Readonly<
  Record<ImpactSurface, Readonly<Record<ImpactLook, readonly EffectName[]>>>
> = {
  metal: { shell: ['flash', 'sparks'], tracer: ['sparksSmall'] },
  stone: { shell: ['flash', 'dust', 'chips'], tracer: ['dustSmall'] },
  wood: { shell: ['flash', 'woodDust', 'splinters'], tracer: ['dustSmall'] },
};

/** The effects a shot fires on impact (M6-1a, plan D13): sparks on tanks, dust on cover and walls. */
export function impactEffects(surface: ImpactSurface, look: ImpactLook): readonly EffectName[] {
  return IMPACTS[surface][look];
}

/**
 * A cannon shell's smoke trail (M6-2a, Brendan: "like Halo and the
 * prototype"): puffs left every `spacing` u along the shell's path that stay
 * where they were left, swell and fade, so the trail dissipates behind it.
 */
export interface TrailDef {
  readonly spacing: number;
  readonly lifetime: readonly [number, number];
  readonly size: readonly [number, number];
  readonly growth: number;
  /** Slow drift of each puff, u/s. */
  readonly drift: readonly [number, number];
  /** Upward pull, u/s² (smoke rises). */
  readonly rise: number;
  readonly colour: { readonly start: Rgba; readonly end: Rgba };
  /** Fraction of its life a puff stays at full colour before fading (see `BurstEffectDef.fadeFrom`). */
  readonly fadeFrom: number;
}

export const SHELL_TRAIL: TrailDef = {
  spacing: 0.3,
  lifetime: [0.9, 1.4],
  size: [0.5, 0.65],
  growth: 2.4,
  drift: [0.05, 0.3],
  rise: 0.25,
  colour: { start: [0.88, 0.87, 0.84, 0.5], end: [0.74, 0.74, 0.72, 0] },
  fadeFrom: 0.35,
};

/** How far back (u) each barrel look kicks when it fires, and how long it takes to return (s). */
export const RECOIL: Readonly<
  Record<'tube-brake' | 'thin-tube', { readonly kick: number; readonly returnTime: number }>
> = {
  'tube-brake': { kick: 0.3, returnTime: 0.28 },
  'thin-tube': { kick: 0.04, returnTime: 0.06 },
};

/** The cannon's muzzle-flash light: warm, brief, lighting the ground and nearby tanks. */
export const MUZZLE_LIGHT = {
  colour: [1, 0.7, 0.35],
  intensity: 2.2,
  range: 7,
  duration: 0.08,
} as const;

/** Screen shake (M6-1b, plan D6): trauma decays over ~0.5 s; full trauma nudges the camera 0.6 u. */
export const SHAKE = { decayPerSecond: 2, maxOffset: 0.6, frequency: 9 } as const;

/** Trauma per event (GDD §8: cannon fire small, player hit medium, nearby kill medium). */
export const SHAKE_TRAUMA = {
  playerCannon: 0.4,
  playerHit: 0.45,
  nearbyKill: 0.5,
  /** A kill counts as "nearby" within this distance (u) of the player. */
  nearbyRadius: 12,
} as const;

/** A tank that takes damage glows white-hot for this long (M6-1b, plan D8). */
export const HIT_FLASH = { duration: 0.12, strength: 0.85 } as const;
