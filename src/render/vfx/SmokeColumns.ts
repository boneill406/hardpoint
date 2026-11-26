import { ParticleSystem, Vector3 } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import type { SmokeColumnDef } from './effects';
import { emissionThisFrame } from './firingMotion';
import { addFade } from './particleFade';

/** Puffs alive at once across all columns. */
const CAPACITY = 600;

interface Column {
  readonly point: Vec2;
  left: number;
  carry: number;
}

/**
 * Smoke rising from destroyed tanks (M6-3, plan D12). One particle system for
 * every column, like the shell trails: each column emits for `seconds`, its
 * puffs placed (with a little jitter) at the wreck via `startPositionFunction`.
 * Puffs rise, swell and fade; the column thins out as emission stops.
 */
export class SmokeColumns {
  private readonly system: ParticleSystem;
  private columns: Column[] = [];
  private pending: Vector3[] = [];
  /** Render-side randomness for the jitter: fine here, it's not the sim. */
  private readonly random = Math.random;

  constructor(
    scene: Scene,
    texture: Texture,
    private readonly def: SmokeColumnDef,
  ) {
    const system = new ParticleSystem('vfx-smoke-column', CAPACITY, scene);
    system.particleTexture = texture;
    system.emitter = Vector3.Zero();
    system.emitRate = 0;
    system.updateSpeed = 1 / 60;
    system.minLifeTime = def.lifetime[0];
    system.maxLifeTime = def.lifetime[1];
    system.minEmitPower = def.rise[0];
    system.maxEmitPower = def.rise[1];
    system.direction1 = new Vector3(-0.15, 1, -0.15);
    system.direction2 = new Vector3(0.15, 1, 0.15);
    system.gravity = Vector3.Zero();
    const [small, large] = def.size;
    system.addSizeGradient(0, small, large);
    system.addSizeGradient(1, small * def.growth, large * def.growth);
    addFade(system, def.colour.start, def.colour.end, def.fadeFrom);
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    system.startPositionFunction = (_world, position): void => {
      const next = this.pending.shift();
      if (next !== undefined) {
        position.copyFrom(next);
      }
    };
    system.start();
    this.system = system;
  }

  /** Starts a column at `point` (a destroyed tank). */
  start(point: Vec2): void {
    this.columns.push({ point, left: this.def.seconds, carry: 0 });
  }

  /** Once per frame: each live column emits its share of puffs. */
  update(frameSeconds: number): void {
    for (const column of this.columns) {
      const { count, carry } = emissionThisFrame(this.def.rate, frameSeconds, column.carry);
      column.carry = carry;
      column.left -= frameSeconds;
      for (let i = 0; i < count; i++) {
        const jitter = new Vec2(
          (this.random() - 0.5) * 2 * this.def.jitter,
          (this.random() - 0.5) * 2 * this.def.jitter,
        );
        this.pending.push(toBabylonPosition(column.point.add(jitter), 0.6));
      }
    }
    this.columns = this.columns.filter((column) => column.left > 0);
    this.system.manualEmitCount = this.pending.length;
  }

  clear(): void {
    this.columns = [];
    this.pending = [];
    this.system.reset();
  }

  dispose(): void {
    this.system.dispose(false);
  }
}
