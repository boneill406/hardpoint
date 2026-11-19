import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { Transform } from '../../sim/core/Transform';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

/** Body size in units (width x, height y, length z). Cosmetic: DebugMover has no collision shape. */
const BODY = { width: 1.4, height: 0.6, depth: 2 };
/** The nose sits on the front (+z) so heading is visible at a glance. */
const NOSE = { width: 0.5, height: 0.4, depth: 0.7 };

/**
 * Temporary view for the M1 `DebugMover`: a box with a nose pointing along its
 * heading. Deleted with `DebugMover` in M2.
 */
export class DebugMoverView implements EntityView {
  private readonly root: TransformNode;

  constructor(scene: Scene, name: string) {
    this.root = new TransformNode(name, scene);

    const body = MeshBuilder.CreateBox(`${name}-body`, BODY, scene);
    body.position.y = BODY.height / 2;
    body.material = this.createMaterial(scene, `${name}-body-mat`, new Color3(0.85, 0.55, 0.2));
    body.parent = this.root;

    const nose = MeshBuilder.CreateBox(`${name}-nose`, NOSE, scene);
    nose.position.set(0, NOSE.height / 2, BODY.depth / 2 + NOSE.depth / 2);
    nose.material = this.createMaterial(scene, `${name}-nose-mat`, new Color3(0.95, 0.9, 0.8));
    nose.parent = this.root;
  }

  update(transform: Transform): void {
    this.root.position = toBabylonPosition(transform.position);
    this.root.rotation.y = toBabylonRotationY(transform.heading);
  }

  dispose(): void {
    // false: also dispose child meshes; true: also dispose their materials.
    this.root.dispose(false, true);
  }

  private createMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.specularColor = Color3.Black();
    return material;
  }
}
