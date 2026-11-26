import { castShadow } from '../shadows';
import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Prop, PropKind } from '../../sim/arena/Prop';
import type { Transform } from '../../sim/core/Transform';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

/** A crate's drawn height (u): it hides a hull but not a turret. Also used for its break-apart (M6-4). */
export const CRATE_HEIGHT = 1.1;

/** Cosmetic heights (u): pillars stand above a tank, crates hide a hull but not a turret. */
const LOOK: Readonly<Record<PropKind, { readonly height: number; readonly color: Color3 }>> = {
  pillar: { height: 2.5, color: new Color3(0.5, 0.5, 0.52) },
  crate: { height: CRATE_HEIGHT, color: new Color3(0.55, 0.4, 0.22) },
};

/**
 * A pillar or crate: a box exactly the size of the prop's footprint (its
 * collision box from M2-3). Disposed by `RenderBridge` when a crate is destroyed.
 */
export class PropView implements EntityView {
  private readonly mesh: Mesh;
  private readonly height: number;

  constructor(scene: Scene, name: string, prop: Prop) {
    const look = LOOK[prop.kind];
    this.height = look.height;
    this.mesh = MeshBuilder.CreateBox(
      name,
      { width: prop.size.width, depth: prop.size.depth, height: look.height },
      scene,
    );
    const material = new StandardMaterial(`${name}-mat`, scene);
    material.diffuseColor = look.color;
    material.specularColor = Color3.Black();
    this.mesh.material = material;
    castShadow(this.mesh);
  }

  update(transform: Transform): void {
    this.mesh.position = toBabylonPosition(transform.position, this.height / 2);
    this.mesh.rotation.y = toBabylonRotationY(transform.heading);
  }

  dispose(): void {
    this.mesh.dispose(false, true);
  }
}
