import { Color3, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition } from '../coords';
import { CASINGS, type CasingKindDef } from './effects';
import {
  casingOpacity,
  lyingYaw,
  settleEase,
  stepCasing,
  type CasingPhysics,
  type CasingState,
} from './casingMotion';

export type CasingKind = 'mg' | 'cannon';

interface Casing {
  readonly mesh: Mesh;
  state: CasingState;
  /** Tumble rate (rad/s) about a random axis; slows at each bounce. */
  spin: number;
  readonly spinAxis: Vector3;
  /** Set once it lands for good: the orientation it eases from and to, and how far along. */
  settle: { readonly from: Quaternion; readonly to: Quaternion; t: number } | undefined;
  age: number;
}

interface Pool {
  readonly def: CasingKindDef;
  readonly physics: CasingPhysics;
  readonly casings: Casing[];
  next: number;
}

/**
 * Spent shell casings (M6-2b, plan D11): the MG pours small brass out to its
 * left (the coax's side), the cannon pops a big case out of the back of the
 * turret a moment after firing. Each casing
 * flies and tumbles, bounces on the floor (`stepCasing`; MG twice, cannon
 * three times) with its spin slowing each time, then eases into lying flat
 * pointing the way it was already pointing (no snap), lies a while and fades.
 * Pooled per kind and reused oldest-first. Render-only: casings don't collide.
 */
export class Casings {
  private readonly pools: Record<CasingKind, Pool>;
  /** Render-side randomness (spread and tumble of each ejection): fine here, not the sim. */
  private readonly random = Math.random;

  constructor(scene: Scene) {
    this.pools = {
      mg: this.createPool(scene, 'mg', CASINGS.mg),
      cannon: this.createPool(scene, 'cannon', CASINGS.cannon),
    };
  }

  /**
   * Throws a casing out of a gun whose breech is at `breech` (`height` u up),
   * facing `heading`: sideways and up for the MG, back and up for the cannon
   * (directions from `CASINGS`).
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
    casing.spin = def.spin * (0.6 + 0.4 * this.random());
    casing.spinAxis
      .set(this.random() - 0.5, (this.random() - 0.5) * 0.4, this.random() - 0.5)
      .normalize();
    casing.settle = undefined;
    casing.age = 0;
    // Leaves the breech lying across the gun, as a spent case does.
    casing.mesh.rotationQuaternion = Quaternion.RotationYawPitchRoll(heading, Math.PI / 2, 0);
    casing.mesh.visibility = 1;
    casing.mesh.setEnabled(true);
  }

  update(frameSeconds: number): void {
    for (const pool of Object.values(this.pools)) {
      for (const casing of pool.casings) {
        if (casing.mesh.isEnabled()) {
          this.updateCasing(casing, frameSeconds, pool.physics);
        }
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

  private updateCasing(casing: Casing, frameSeconds: number, physics: CasingPhysics): void {
    casing.age += frameSeconds;
    const before = casing.state;
    casing.state = stepCasing(before, frameSeconds, physics);
    const { mesh, state } = casing;
    mesh.position.set(state.x, state.y, state.z);
    if (state.bounces > before.bounces) {
      casing.spin *= CASINGS.spinKept;
    }
    if (state.resting && !before.resting) {
      casing.settle = { from: this.orientation(mesh), to: this.lyingFlat(mesh), t: 0 };
    }
    if (casing.settle !== undefined) {
      casing.settle.t = Math.min(1, casing.settle.t + frameSeconds / CASINGS.settle);
      mesh.rotationQuaternion = Quaternion.Slerp(
        casing.settle.from,
        casing.settle.to,
        settleEase(casing.settle.t),
      );
    } else {
      const turn = Quaternion.RotationAxis(casing.spinAxis, casing.spin * frameSeconds);
      mesh.rotationQuaternion = turn.multiply(this.orientation(mesh));
    }
    mesh.visibility = casingOpacity(casing.age, CASINGS.lie, CASINGS.fade);
    if (mesh.visibility === 0) {
      mesh.setEnabled(false);
    }
  }

  private orientation(mesh: Mesh): Quaternion {
    return mesh.rotationQuaternion?.clone() ?? Quaternion.Identity();
  }

  /** Lying on its side along the floor, pointing the way its long axis points now. */
  private lyingFlat(mesh: Mesh): Quaternion {
    const axis = Vector3.Up().rotateByQuaternionToRef(this.orientation(mesh), new Vector3());
    const yaw = lyingYaw(axis, this.random() * Math.PI * 2);
    return Quaternion.RotationYawPitchRoll(yaw, Math.PI / 2, 0);
  }

  private createPool(scene: Scene, kind: CasingKind, def: CasingKindDef): Pool {
    const material = new StandardMaterial(`casing-${kind}-mat`, scene);
    material.diffuseColor = new Color3(...def.colour);
    material.specularColor = new Color3(0.6, 0.5, 0.3);
    material.specularPower = 24;
    const casings = Array.from({ length: def.pool }, (_, i): Casing => {
      const mesh = MeshBuilder.CreateCylinder(
        `casing-${kind}-${i}`,
        { height: def.length, diameter: def.diameter, tessellation: 8 },
        scene,
      );
      mesh.material = material;
      mesh.isPickable = false;
      mesh.rotationQuaternion = Quaternion.Identity();
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
      return {
        mesh,
        state,
        spin: 0,
        spinAxis: new Vector3(1, 0, 0),
        settle: undefined,
        age: Number.POSITIVE_INFINITY,
      };
    });
    const physics = { ...CASINGS.physics, maxBounces: def.bounces, restHeight: def.diameter / 2 };
    return { def, physics, casings, next: 0 };
  }

  private between([low, high]: readonly [number, number]): number {
    return low + this.random() * (high - low);
  }
}
