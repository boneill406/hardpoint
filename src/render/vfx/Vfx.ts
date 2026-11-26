import { ParticleSystem, Vector3 } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import {
  EFFECTS,
  EXPLOSION_BURSTS,
  EXPLOSION_LIGHT,
  SHELL_TRAIL,
  SMOKE_COLUMN,
  type BurstEffectDef,
  type EffectName,
  type ParticleTexture,
} from './effects';
import { addFade } from './particleFade';
import { Casings, type CasingKind } from './Casings';
import { CrateChunks } from './CrateChunks';
import { MuzzleLights } from './MuzzleLights';
import { TreadMarks, type TrackedTank } from './TreadMarks';
import { Scorches } from './Scorches';
import { SmokeColumns } from './SmokeColumns';
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
  private readonly columns: SmokeColumns;
  private readonly scorches: Scorches;
  private readonly casings: Casings;
  private readonly chunks: CrateChunks;
  private readonly treads: TreadMarks;

  /** `trailHeight`: the height (u) cannon shells fly at, where their smoke is laid. */
  constructor(scene: Scene, trailHeight: number) {
    this.textures = createParticleTextures(scene);
    this.trails = new ShellTrails(scene, this.textures.smoke, SHELL_TRAIL, trailHeight);
    this.lights = new MuzzleLights(scene);
    this.columns = new SmokeColumns(scene, this.textures.smoke, SMOKE_COLUMN);
    this.scorches = new Scorches(scene, this.textures.soft);
    this.casings = new Casings(scene);
    this.chunks = new CrateChunks(scene);
    this.treads = new TreadMarks(scene);
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

  /**
   * A crate was destroyed (M6-4): wood dust and splinters, and chunks thrown
   * out of a `width` × `depth` × `height` crate at `point`.
   */
  breakCrate(point: Vec2, width: number, depth: number, height: number): void {
    this.burst('woodDust', point, height / 2, Vec2.ZERO);
    this.burst('splinters', point, height / 2, Vec2.ZERO);
    const at = toBabylonPosition(point);
    this.chunks.burst(at.x, at.z, width, depth, height);
  }

  /** A gun fired: throw its spent casing out of the breech (M6-2b). */
  eject(kind: CasingKind, breech: Vec2, height: number, heading: number): void {
    this.casings.eject(kind, breech, height, heading);
  }

  /**
   * A tank was destroyed at `point` (M6-3, plan D12): fireball, sparks and
   * debris at hull height, a bright flash of light, a column of smoke for
   * ~2 s, and a burn mark on the floor.
   */
  explode(point: Vec2): void {
    for (const effect of EXPLOSION_BURSTS) {
      this.burst(effect, point, 0.8, Vec2.ZERO);
    }
    this.lights.flash(point, 1.2, EXPLOSION_LIGHT.intensity, EXPLOSION_LIGHT.duration);
    this.columns.start(point);
    this.scorches.add(point);
  }

  /** Once per frame: shell trails along this frame's movement, and fading muzzle lights. */
  update(
    shells: readonly TrailedShell[],
    tanks: readonly TrackedTank[],
    frameSeconds: number,
  ): void {
    this.trails.update(shells);
    this.treads.update(tanks, frameSeconds);
    this.chunks.update(frameSeconds);
    this.lights.update(frameSeconds);
    this.columns.update(frameSeconds);
    this.scorches.update(frameSeconds);
    this.casings.update(frameSeconds);
  }

  /** Removes every particle in flight (a new run starts). */
  clear(): void {
    this.trails.clear();
    this.lights.clear();
    this.columns.clear();
    this.scorches.clear();
    this.casings.clear();
    this.chunks.clear();
    this.treads.clear();
    for (const pool of this.pools.values()) {
      for (const system of pool.systems) {
        system.reset();
      }
    }
  }

  dispose(): void {
    this.trails.dispose();
    this.lights.dispose();
    this.columns.dispose();
    this.scorches.dispose();
    this.casings.dispose();
    this.chunks.dispose();
    this.treads.dispose();
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
