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
  /** `add` glows (sparks, flashes); `alpha` is ordinary see-through (dust, smoke). */
  readonly blend: 'add' | 'alpha';
  /** Sparks stretch along their motion; everything else is a round billboard. */
  readonly stretched: boolean;
}

export type EffectName =
  'flash' | 'sparks' | 'sparksSmall' | 'dust' | 'dustSmall' | 'chips' | 'woodDust' | 'splinters';

export const EFFECTS: Readonly<Record<EffectName, BurstEffectDef>> = {
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
