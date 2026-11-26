import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { CASINGS, type CasingKindDef } from './effects';
import { casingOpacity, stepCasing, type CasingState } from './casingMotion';

export type CasingKind = 'mg' | 'cannon';

interface Casing {
  readonly mesh: Mesh;
  state: CasingState;
  /** Tumble axis rates (rad/s); zero once it rests. */
  spinX: number;
  spinZ: number;
  age: number;
}

interface Pool {
  readonly def: CasingKindDef;
  readonly casings: Casing[];
  next: number;
}

/**
 * Spent shell casings (M6-2b, plan D11): the MG pours small brass out to its
 * right, the cannon pops a big case out of the back of the turret. Each casing
 * flies, tumbles, bounces twice on the floor (`stepCasing`), lies there a
 * while and fades. Pooled per kind and reused oldest-first, so a long MG burst
 * never creates meshes. Render-only: casings don't collide with anything.
 */
export class Casings {
  private readonly pools: Record<CasingKind, Pool>;
  /** Render-side randomness (spread of each ejection): fine here, not the sim. */
  private readonly random = Math.random;

  constructor(scene: Scene) {
    this.pools = {
      mg: this.createPool(scene, 'mg', CASINGS.mg),
      cannon: this.createPool(scene, 'cannon', CASINGS.cannon),
    };
  }

  /**
   * Throws a casing out of a gun whose breech is at `breech` (`height` u up),
   * facing `heading`: to the gun's right and up for the MG, back and up for the
   * cannon.
   */
  eject(kind: CasingKind, breech: Vec2, height: number, heading: number): void {
    const pool = this.pools[kind];
    const casing = pool.casings[pool.next];
    if (casing === undefined) {
      return;
    }
    pool.next = (pool.next + 1) % pool.casings.length;
    const { def } = pool;
    const forward = Vec2.fromHeading(heading);
    const right = Vec2.fromHeading(heading + Math.PI / 2);
    const velocity = right
      .scale(this.between(def.side))
      .add(forward.scale(-this.between(def.back)));
    const start = toBabylonPosition(breech, height);
    casing.state = {
      x: start.x,
      y: start.y,
      z: start.z,
      vx: velocity.x,
      vy: this.between(def.up),
      vz: velocity.z,
      bounces: 0,
      resting: false,
    };
    casing.spinX = (this.random() - 0.5) * 2 * def.spin;
    casing.spinZ = (this.random() - 0.5) * 2 * def.spin;
    casing.age = 0;
    casing.mesh.rotation.set(0, heading, 0);
    casing.mesh.visibility = 1;
    casing.mesh.setEnabled(true);
  }

  update(frameSeconds: number): void {
    for (const pool of Object.values(this.pools)) {
      const physics = { ...CASINGS.physics, restHeight: pool.def.diameter / 2 };
      for (const casing of pool.casings) {
        if (!casing.mesh.isEnabled()) {
          continue;
        }
        this.updateCasing(casing, frameSeconds, physics);
      }
    }
  }

  clear(): void {
    for (const pool of Object.values(this.pools)) {
      for (const casing of pool.casings) {
        casing.mesh.setEnabled(false);
      }
    }
  }

  dispose(): void {
    for (const pool of Object.values(this.pools)) {
      for (const casing of pool.casings) {
        casing.mesh.dispose();
      }
    }
  }

  private updateCasing(
    casing: Casing,
    frameSeconds: number,
    physics: Parameters<typeof stepCasing>[2],
  ): void {
    casing.age += frameSeconds;
    const wasResting = casing.state.resting;
    casing.state = stepCasing(casing.state, frameSeconds, physics);
    const { mesh, state } = casing;
    mesh.position.set(state.x, state.y, state.z);
    if (state.resting) {
      if (!wasResting) {
        // Settle lying on its side (a cylinder's axis is y; lay it along the floor).
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = 0;
        // Each lands pointing its own way, so a pile doesn't look stamped.
        mesh.rotation.y = this.random() * Math.PI * 2;
      }
    } else {
      mesh.rotation.x += casing.spinX * frameSeconds;
      mesh.rotation.z += casing.spinZ * frameSeconds;
    }
    mesh.visibility = casingOpacity(casing.age, CASINGS.lie, CASINGS.fade);
    if (mesh.visibility === 0) {
      mesh.setEnabled(false);
    }
  }

  private createPool(scene: Scene, kind: CasingKind, def: CasingKindDef): Pool {
    const material = new StandardMaterial(`casing-${kind}-mat`, scene);
    material.diffuseColor = new Color3(...def.colour);
    material.specularColor = new Color3(0.6, 0.5, 0.3);
    material.specularPower = 24;
    const casings = Array.from({ length: def.pool }, (_, i) => {
      const mesh = MeshBuilder.CreateCylinder(
        `casing-${kind}-${i}`,
        { height: def.length, diameter: def.diameter, tessellation: 8 },
        scene,
      );
      mesh.material = material;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      const state: CasingState = {
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        bounces: 0,
        resting: true,
      };
      return { mesh, state, spinX: 0, spinZ: 0, age: Number.POSITIVE_INFINITY };
    });
    return { def, casings, next: 0 };
  }

  private between([low, high]: readonly [number, number]): number {
    return low + this.random() * (high - low);
  }
}
