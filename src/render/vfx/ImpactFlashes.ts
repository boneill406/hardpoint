import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { FLIGHT_HEIGHT } from '../views/ProjectileView';

type Look = keyof typeof FLIGHT_HEIGHT;

/** Seconds a flash lasts. */
const LIFETIME = 0.12;
/** Flash diameter (u) at its biggest: a shell's is clearly bigger than an MG round's. */
const SIZE: Readonly<Record<Look, number>> = { shell: 0.7, tracer: 0.25 };

interface Flash {
  readonly mesh: Mesh;
  readonly size: number;
  age: number;
}

/**
 * Placeholder impact effect (M3-3, until M6's sparks and dust): a small
 * self-lit burst where a shot hit, swelling and fading out over ~0.1 s. Driven
 * by `ProjectileImpact` events, so close-range shots whose flight is shorter
 * than a tick still visibly land. Render-only.
 */
export class ImpactFlashes {
  private readonly flashes: Flash[] = [];
  private readonly material: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.material = new StandardMaterial('impact-flash-mat', scene);
    this.material.emissiveColor = Color3.FromHexString('#ffd27a');
    this.material.disableLighting = true;
  }

  /** Starts a flash at a shot's impact point, at the height that kind of shot flies. */
  spawn(point: Vec2, look: Look): void {
    const mesh = MeshBuilder.CreateSphere('impact-flash', { diameter: 1, segments: 6 }, this.scene);
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.position = toBabylonPosition(point, FLIGHT_HEIGHT[look]);
    mesh.scaling.setAll(0.01);
    this.flashes.push({ mesh, size: SIZE[look], age: 0 });
  }

  /** Grows each flash to full size, fades it (per-mesh visibility, shared material), then removes it. */
  update(frameSeconds: number): void {
    for (const flash of this.flashes) {
      flash.age += frameSeconds;
      const t = Math.min(1, flash.age / LIFETIME);
      flash.mesh.scaling.setAll(flash.size * (0.4 + 0.6 * t));
      flash.mesh.visibility = 1 - t;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i];
      if (flash !== undefined && flash.age >= LIFETIME) {
        flash.mesh.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  /** Removes every flash (a new run starts). */
  clear(): void {
    for (const flash of this.flashes) {
      flash.mesh.dispose();
    }
    this.flashes.length = 0;
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
  }
}
