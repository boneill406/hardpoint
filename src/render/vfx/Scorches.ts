import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene, Texture } from '@babylonjs/core';
import type { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { SCORCH } from './effects';
import { scorchOpacity } from './firingMotion';

interface Mark {
  readonly mesh: Mesh;
  age: number;
}

/**
 * Burn marks where tanks died (M6-3, plan D12): flat dark discs on the floor
 * that hold, then fade. Pooled: at most `SCORCH.max`, created once; a new kill
 * reuses the oldest. One shared material; each disc fades by its own
 * visibility. Render-only.
 */
export class Scorches {
  private readonly marks: Mark[];
  private next = 0;
  private readonly material: StandardMaterial;

  constructor(scene: Scene, texture: Texture) {
    this.material = new StandardMaterial('scorch-mat', scene);
    this.material.diffuseTexture = texture;
    this.material.opacityTexture = texture;
    this.material.diffuseColor = Color3.Black();
    this.material.specularColor = Color3.Black();
    this.material.emissiveColor = new Color3(0.03, 0.025, 0.02);
    this.marks = Array.from({ length: SCORCH.max }, (_, i) => {
      const mesh = MeshBuilder.CreateGround(
        `scorch-${i}`,
        { width: SCORCH.radius * 2, height: SCORCH.radius * 2 },
        scene,
      );
      mesh.material = this.material;
      mesh.isPickable = false;
      mesh.visibility = 0;
      mesh.setEnabled(false);
      return { mesh, age: Number.POSITIVE_INFINITY };
    });
  }

  /** A tank died at `point`: lay a burn mark there. */
  add(point: Vec2): void {
    const mark = this.marks[this.next];
    if (mark === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.marks.length;
    // Just above the floor (no z-fighting), turned randomly so marks don't look stamped.
    mark.mesh.position = toBabylonPosition(point, 0.012 + this.next * 0.0005);
    mark.mesh.rotation.y = Math.random() * Math.PI * 2;
    mark.mesh.setEnabled(true);
    mark.age = 0;
  }

  update(frameSeconds: number): void {
    for (const mark of this.marks) {
      if (!mark.mesh.isEnabled()) {
        continue;
      }
      mark.age += frameSeconds;
      const opacity = scorchOpacity(mark.age, SCORCH.opacity, SCORCH.fadeSeconds);
      mark.mesh.visibility = opacity;
      if (opacity === 0) {
        mark.mesh.setEnabled(false);
      }
    }
  }

  clear(): void {
    for (const mark of this.marks) {
      mark.mesh.setEnabled(false);
      mark.age = Number.POSITIVE_INFINITY;
    }
  }

  dispose(): void {
    for (const mark of this.marks) {
      mark.mesh.dispose();
    }
    this.material.dispose();
  }
}
