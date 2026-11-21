import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Projectile } from '../../sim/combat/Projectile';
import type { WeaponDef } from '../../sim/combat/WeaponDef';
import type { Transform } from '../../sim/core/Transform';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView } from './EntityView';

type Look = WeaponDef['projectile']['look'];

/** Height (u) shots fly at: the barrel's height on the primitive tank. Cosmetic; the sim is planar. */
const FLIGHT_HEIGHT = 0.87;

/** Sizes (u) and colours. The tracer is long and self-lit so a 100 u/s round reads as a streak. */
const LOOKS: Readonly<
  Record<
    Look,
    {
      readonly size: { width: number; height: number; depth: number };
      readonly color: Color3;
      readonly glows: boolean;
    }
  >
> = {
  shell: {
    size: { width: 0.12, height: 0.12, depth: 0.34 },
    color: Color3.FromHexString('#c9a15a'),
    glows: false,
  },
  tracer: {
    size: { width: 0.05, height: 0.05, depth: 0.7 },
    color: Color3.FromHexString('#ffc46b'),
    glows: true,
  },
};

/** One material per look per scene: the MG fires 10 rounds a second, so don't make one per shot. */
const sharedMaterials = new WeakMap<Scene, Map<Look, StandardMaterial>>();

function materialFor(scene: Scene, look: Look): StandardMaterial {
  let byLook = sharedMaterials.get(scene);
  if (byLook === undefined) {
    byLook = new Map();
    sharedMaterials.set(scene, byLook);
  }
  let material = byLook.get(look);
  if (material === undefined) {
    const { color, glows } = LOOKS[look];
    material = new StandardMaterial(`projectile-${look}-mat`, scene);
    material.diffuseColor = color;
    material.specularColor = Color3.Black();
    if (glows) {
      material.emissiveColor = color;
      material.disableLighting = true;
    }
    byLook.set(look, material);
  }
  return material;
}

/**
 * A shell or tracer in flight (M3-3). Its tip sits at the sim position, so a
 * shot that stops on impact ends exactly at the surface it hit. Impact sparks
 * and trails come with the juice pass (M6).
 */
export class ProjectileView implements EntityView {
  private readonly mesh: Mesh;
  private readonly halfLength: number;

  constructor(scene: Scene, name: string, projectile: Projectile) {
    const look = LOOKS[projectile.weapon.projectile.look];
    this.halfLength = look.size.depth / 2;
    this.mesh = MeshBuilder.CreateBox(name, look.size, scene);
    this.mesh.material = materialFor(scene, projectile.weapon.projectile.look);
    this.mesh.isPickable = false;
  }

  update(transform: Transform): void {
    const { position, heading } = transform;
    // Centre the body half a length behind the tip.
    const centre = position.sub(Vec2.fromHeading(heading).scale(this.halfLength));
    this.mesh.position = toBabylonPosition(centre, FLIGHT_HEIGHT);
    this.mesh.rotation.y = toBabylonRotationY(heading);
  }

  dispose(): void {
    // Keep the shared material for the next shot.
    this.mesh.dispose(false, false);
  }
}
