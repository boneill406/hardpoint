import { Color3, PointLight, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { MUZZLE_LIGHT } from './effects';
import { flashIntensity } from './firingMotion';

/** Cannon flashes lit at once; with the ambient and the sun that's 4 lights, Babylon's per-material default. */
const POOL_SIZE = 2;

interface Slot {
  readonly light: PointLight;
  age: number;
}

/**
 * The cannon's muzzle-flash light (M6-2a, GDD §8): a warm point light that
 * lights the ground and nearby tanks for ~0.08 s. A small pool, always
 * enabled at zero brightness when idle: switching lights on and off would
 * change every material's light count and make Babylon recompile shaders
 * mid-game.
 */
export class MuzzleLights {
  private readonly slots: Slot[];
  private next = 0;

  constructor(scene: Scene) {
    const [r, g, b] = MUZZLE_LIGHT.colour;
    this.slots = Array.from({ length: POOL_SIZE }, (_, i) => {
      const light = new PointLight(`muzzle-light-${i}`, Vector3.Zero(), scene);
      light.diffuse = new Color3(r, g, b);
      light.specular = Color3.Black();
      light.range = MUZZLE_LIGHT.range;
      light.intensity = 0;
      return { light, age: Number.POSITIVE_INFINITY };
    });
  }

  flash(point: Vec2, height: number): void {
    const slot = this.slots[this.next];
    if (slot === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.slots.length;
    slot.light.position = toBabylonPosition(point, height);
    slot.age = 0;
  }

  update(frameSeconds: number): void {
    for (const slot of this.slots) {
      slot.age += frameSeconds;
      slot.light.intensity =
        MUZZLE_LIGHT.intensity * flashIntensity(slot.age, MUZZLE_LIGHT.duration);
    }
  }

  clear(): void {
    for (const slot of this.slots) {
      slot.age = Number.POSITIVE_INFINITY;
      slot.light.intensity = 0;
    }
  }

  dispose(): void {
    for (const slot of this.slots) {
      slot.light.dispose();
    }
  }
}
