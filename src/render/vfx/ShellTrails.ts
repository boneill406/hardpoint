import { ParticleSystem, Vector3 } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import type { EntityId } from '../../sim/core/Entity';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import type { TrailDef } from './effects';
import { pointsAlong } from './firingMotion';
import { addFade } from './Vfx';

/** Puffs alive at once across all trails (a few shells' worth). */
const CAPACITY = 3000;

interface Tracked {
  last: Vec2;
  carry: number;
}

/** One shell to trail this frame: its id and where it is drawn. */
export interface TrailedShell {
  readonly id: EntityId;
  readonly position: Vec2;
}

/**
 * Smoke trails behind cannon shells (M6-2a, plan D10). One particle system
 * serves every shell: each frame, puffs are placed evenly along the stretch
 * each shell moved (so a 90 u/s shell leaves no gaps), and they stay where
 * they were put, drifting, swelling and fading. When a shell is gone its
 * trail simply stops; the puffs already out live on and dissipate.
 */
export class ShellTrails {
  private readonly system: ParticleSystem;
  private readonly shells = new Map<EntityId, Tracked>();
  /** Where the next emitted puffs go, consumed by `startPositionFunction`. */
  private pending: Vector3[] = [];

  constructor(
    scene: Scene,
    texture: Texture,
    private readonly def: TrailDef,
    private readonly height: number,
  ) {
    const system = new ParticleSystem('vfx-shell-trail', CAPACITY, scene);
    system.particleTexture = texture;
    system.emitter = Vector3.Zero();
    system.emitRate = 0;
    system.updateSpeed = 1 / 60;
    system.minLifeTime = def.lifetime[0];
    system.maxLifeTime = def.lifetime[1];
    system.minEmitPower = def.drift[0];
    system.maxEmitPower = def.drift[1];
    system.direction1 = new Vector3(-1, 0.2, -1);
    system.direction2 = new Vector3(1, 1, 1);
    system.gravity = new Vector3(0, def.rise, 0);
    const [small, large] = def.size;
    system.addSizeGradient(0, small, large);
    system.addSizeGradient(1, small * def.growth, large * def.growth);
    addFade(system, def.colour.start, def.colour.end, def.fadeFrom);
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    // Place each new puff at the next queued point instead of at the emitter.
    system.startPositionFunction = (_world, position): void => {
      const next = this.pending.shift();
      if (next !== undefined) {
        position.copyFrom(next);
      }
    };
    system.start();
    this.system = system;
  }

  /** Once per frame with the shells now drawn: lay smoke along each one's path since last frame. */
  update(shells: readonly TrailedShell[]): void {
    const live = new Set<EntityId>();
    for (const shell of shells) {
      live.add(shell.id);
      const tracked = this.shells.get(shell.id);
      if (tracked === undefined) {
        this.shells.set(shell.id, { last: shell.position, carry: 0 });
        continue;
      }
      const { points, carry } = pointsAlong(
        tracked.last,
        shell.position,
        this.def.spacing,
        tracked.carry,
      );
      for (const point of points) {
        this.pending.push(toBabylonPosition(new Vec2(point.x, point.z), this.height));
      }
      tracked.last = shell.position;
      tracked.carry = carry;
    }
    for (const id of this.shells.keys()) {
      if (!live.has(id)) {
        this.shells.delete(id);
      }
    }
    this.system.manualEmitCount = this.pending.length;
  }

  /** Every trail gone at once (a new run). */
  clear(): void {
    this.shells.clear();
    this.pending = [];
    this.system.reset();
  }

  dispose(): void {
    this.system.dispose(false);
  }
}
