import { Color4, ParticleSystem, Vector3 } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import type { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import {
  EFFECTS,
  SHELL_TRAIL,
  type BurstEffectDef,
  type EffectName,
  type ParticleTexture,
  type Rgba,
} from './effects';
import { MuzzleLights } from './MuzzleLights';
import { ShellTrails, type TrailedShell } from './ShellTrails';
import { createParticleTextures } from './particleTextures';
import { sprayCone } from './sprayCone';

/** Particle systems kept per effect: up to this many bursts of one effect can overlap. */
const POOL_SIZE = 6;
/** Particle lifetimes and speeds in the defs are per second; Babylon steps `updateSpeed` per 60 Hz frame. */
const SECONDS_PER_FRAME = 1 / 60;

interface Pool {
  readonly systems: readonly ParticleSystem[];
  next: number;
}

/**
 * The effect system (M6 plan D1): pooled Babylon particle systems built once
 * from the defs in `effects.ts`, then reused for every burst, never new
 * geometry per shot (the prototype's mistake, lessons-learned). Each effect
 * gets a few systems used round-robin, because a system emits from one
 * position at a time and bursts can overlap. Particles live in world space,
 * so a burst stays where it happened. Render-only.
 */
export class Vfx {
  private readonly textures: Record<ParticleTexture, Texture>;
  private readonly pools = new Map<EffectName, Pool>();
  private readonly trails: ShellTrails;
  private readonly lights: MuzzleLights;

  /** `trailHeight`: the height (u) cannon shells fly at, where their smoke is laid. */
  constructor(scene: Scene, trailHeight: number) {
    this.textures = createParticleTextures(scene);
    this.trails = new ShellTrails(scene, this.textures.smoke, SHELL_TRAIL, trailHeight);
    this.lights = new MuzzleLights(scene);
    for (const [name, def] of Object.entries(EFFECTS) as [EffectName, BurstEffectDef][]) {
      const systems = Array.from({ length: POOL_SIZE }, (_, i) =>
        this.createSystem(scene, `${name}-${i}`, def),
      );
      this.pools.set(name, { systems, next: 0 });
    }
  }

  /**
   * Fires one burst of `effect` at `point`, `height` u up, spraying out of the
   * surface along its ground-plane `normal` (zero: up and all round).
   */
  burst(effect: EffectName, point: Vec2, height: number, normal: Vec2): void {
    const pool = this.pools.get(effect);
    const system = pool?.systems[pool.next];
    if (pool === undefined || system === undefined) {
      return;
    }
    pool.next = (pool.next + 1) % pool.systems.length;
    const def = EFFECTS[effect];
    const [a, b] = sprayCone(normal, def.lift, def.spread);
    system.emitter = toBabylonPosition(point, height);
    system.direction1 = new Vector3(a.x, a.y, a.z);
    system.direction2 = new Vector3(b.x, b.y, b.z);
    system.manualEmitCount = def.count;
  }

  /** A cannon fired: light the area around its muzzle for a moment. */
  flashLight(point: Vec2, height: number): void {
    this.lights.flash(point, height);
  }

  /** Once per frame: shell trails along this frame's movement, and fading muzzle lights. */
  update(shells: readonly TrailedShell[], frameSeconds: number): void {
    this.trails.update(shells);
    this.lights.update(frameSeconds);
  }

  /** Removes every particle in flight (a new run starts). */
  clear(): void {
    this.trails.clear();
    this.lights.clear();
    for (const pool of this.pools.values()) {
      for (const system of pool.systems) {
        system.reset();
      }
    }
  }

  dispose(): void {
    this.trails.dispose();
    this.lights.dispose();
    for (const pool of this.pools.values()) {
      for (const system of pool.systems) {
        system.dispose(false);
      }
    }
    this.pools.clear();
    for (const texture of Object.values(this.textures)) {
      texture.dispose();
    }
  }

  private createSystem(scene: Scene, name: string, def: BurstEffectDef): ParticleSystem {
    // Room for two overlapping bursts in one system.
    const system = new ParticleSystem(`vfx-${name}`, Math.max(4, def.count * 2), scene);
    system.particleTexture = this.textures[def.texture];
    system.emitter = Vector3.Zero();
    system.minEmitBox = Vector3.Zero();
    system.maxEmitBox = Vector3.Zero();
    system.emitRate = 0;
    system.manualEmitCount = 0;
    system.updateSpeed = SECONDS_PER_FRAME;
    system.minLifeTime = def.lifetime[0];
    system.maxLifeTime = def.lifetime[1];
    system.minEmitPower = def.speed[0];
    system.maxEmitPower = def.speed[1];
    system.gravity = new Vector3(0, def.gravity, 0);
    const [small, large] = def.size;
    system.addSizeGradient(0, small, large);
    system.addSizeGradient(1, small * def.growth, large * def.growth);
    addFade(system, def.colour.start, def.colour.end, def.fadeFrom ?? 0);
    system.blendMode =
      def.blend === 'add' ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    if (def.stretched) {
      system.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    }
    system.start();
    return system;
  }
}

/** Start colour, held until `fadeFrom` of the particle's life, then a blend to the end colour. */
export function addFade(system: ParticleSystem, start: Rgba, end: Rgba, fadeFrom: number): void {
  system.addColorGradient(0, new Color4(...start));
  if (fadeFrom > 0) {
    system.addColorGradient(fadeFrom, new Color4(...start));
  }
  system.addColorGradient(1, new Color4(...end));
}
