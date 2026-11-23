import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Entity, EntityId } from '../../sim/core/Entity';
import { Vehicle } from '../../sim/vehicles/Vehicle';
import { toBabylonPosition } from '../coords';
import { FLIGHT_HEIGHT } from '../views/ProjectileView';

/** Glow diameter (u) at the start and at the moment of firing. */
const SIZE = { from: 0.12, to: 0.5 };

interface Glow {
  readonly key: string;
  readonly shooter: EntityId;
  readonly hardpoint: string;
  readonly seconds: number;
  readonly mesh: Mesh;
  age: number;
}

/**
 * Placeholder fire telegraph (M4-5, GDD §5 "brief muzzle glow ~0.3 s before
 * each enemy shot"): a hot glow at the muzzle that swells over the windup, so
 * you can see a shot coming and move. Driven by `ShotTelegraphed`; removed on
 * the shot, a cancel, or when the windup time is up. M6 replaces it with a
 * proper light and particles. Render-only.
 */
export class TelegraphGlows {
  private readonly glows = new Map<string, Glow>();
  private readonly material: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.material = new StandardMaterial('telegraph-glow-mat', scene);
    this.material.emissiveColor = Color3.FromHexString('#ff6a2a');
    this.material.disableLighting = true;
  }

  start(shooter: EntityId, hardpoint: string, seconds: number): void {
    this.end(shooter, hardpoint);
    const key = `${shooter}/${hardpoint}`;
    const mesh = MeshBuilder.CreateSphere(
      'telegraph-glow',
      { diameter: 1, segments: 8 },
      this.scene,
    );
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.scaling.setAll(SIZE.from);
    this.glows.set(key, { key, shooter, hardpoint, seconds, mesh, age: 0 });
  }

  end(shooter: EntityId, hardpoint: string): void {
    const key = `${shooter}/${hardpoint}`;
    this.glows.get(key)?.mesh.dispose();
    this.glows.delete(key);
  }

  /** Grows each glow and keeps it on its muzzle as the turret turns. */
  update(entities: readonly Entity[], frameSeconds: number): void {
    for (const glow of [...this.glows.values()]) {
      glow.age += frameSeconds;
      const vehicle = entities.find((entity) => entity.id === glow.shooter);
      const mount =
        vehicle instanceof Vehicle
          ? vehicle.mounts.find((candidate) => candidate.hardpoint.id === glow.hardpoint)
          : undefined;
      // Gone (destroyed) or past its time with no shot event yet: drop it.
      if (!(vehicle instanceof Vehicle) || mount === undefined || glow.age > glow.seconds + 0.1) {
        this.end(glow.shooter, glow.hardpoint);
        continue;
      }
      const t = Math.min(1, glow.age / glow.seconds);
      glow.mesh.scaling.setAll(SIZE.from + (SIZE.to - SIZE.from) * t * t);
      glow.mesh.visibility = 0.5 + 0.5 * t;
      const height = FLIGHT_HEIGHT[mount.weapon.def.projectile.look];
      glow.mesh.position = toBabylonPosition(vehicle.muzzlePosition(mount), height);
    }
  }

  dispose(): void {
    for (const glow of this.glows.values()) {
      glow.mesh.dispose();
    }
    this.glows.clear();
    this.material.dispose();
  }
}
