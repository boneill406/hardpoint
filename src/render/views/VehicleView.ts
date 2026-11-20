import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { Transform } from '../../sim/core/Transform';
import type { Faction } from '../../sim/vehicles/Faction';
import type { HullDef } from '../../sim/vehicles/VehicleDef';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

/** Hull box height in units. Cosmetic only: the sim is planar. */
const HULL_HEIGHT = 0.6;
/** The nose marks the front (+z) so heading is visible at a glance. */
const NOSE = { width: 0.5, height: 0.4, depth: 0.5 };

const FACTION_COLORS: Readonly<Record<Faction, Color3>> = {
  player: new Color3(0.35, 0.55, 0.3),
  insurgent: new Color3(0.75, 0.4, 0.2),
};

/**
 * Placeholder vehicle view: a box exactly the size of the hull footprint
 * (its collision box from M2-3) with a nose on the front. Replaced by the
 * primitive tank (hull, tracks, turret) in M2-6.
 */
export class VehicleView implements EntityView {
  private readonly root: TransformNode;

  constructor(scene: Scene, name: string, hull: HullDef, faction: Faction) {
    this.root = new TransformNode(name, scene);

    const body = MeshBuilder.CreateBox(
      `${name}-hull`,
      { width: hull.width, height: HULL_HEIGHT, depth: hull.length },
      scene,
    );
    body.position.y = HULL_HEIGHT / 2;
    body.material = this.createMaterial(scene, `${name}-hull-mat`, FACTION_COLORS[faction]);
    body.parent = this.root;

    const nose = MeshBuilder.CreateBox(`${name}-nose`, NOSE, scene);
    nose.position.set(0, HULL_HEIGHT + NOSE.height / 2, hull.length / 2 - NOSE.depth / 2);
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
