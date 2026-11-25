import { Color4, ParticleSystem, Vector3 } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import type { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { EFFECTS, type BurstEffectDef, type EffectName, type ParticleTexture } from './effects';
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

  constructor(scene: Scene) {
    this.textures = createParticleTextures(scene);
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

  /** Removes every particle in flight (a new run starts). */
  clear(): void {
    for (const pool of this.pools.values()) {
      for (const system of pool.systems) {
        system.reset();
      }
    }
  }

  dispose(): void {
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
    system.addColorGradient(0, new Color4(...def.colour.start));
    system.addColorGradient(1, new Color4(...def.colour.end));
    system.blendMode =
      def.blend === 'add' ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    if (def.stretched) {
      system.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    }
    system.start();
    return system;
  }
}
