import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { EntityId } from '../../sim/core/Entity';
import { Vec2 } from '../../sim/core/Vec2';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import { TREAD_MARKS } from './effects';
import { markOpacity, trackPoints, type GroundPoint } from './treadMath';

/** A tank as drawn this frame, for laying tread marks. */
export interface TrackedTank {
  readonly id: EntityId;
  readonly position: Vec2;
  readonly heading: number;
  /** Half the distance between its track centrelines (u). */
  readonly trackOffset: number;
}

interface LastPrints {
  left: GroundPoint;
  right: GroundPoint;
}

/** Just above the floor, below scorch marks and casings. */
const HEIGHT = 0.008;

/**
 * Tread marks (M6-4, plan D14): faint dark prints laid every `spacing` u under
 * each track (each track on its own, so a tank pivoting in place prints too),
 * held a few seconds, then faded. One mesh drawn as up to `capacity` GPU thin
 * instances, each with its own matrix and colour (alpha fades it), reused
 * oldest-first: no meshes are created while playing. Render-only.
 */
export class TreadMarks {
  private readonly mesh: Mesh;
  private readonly matrices: Float32Array;
  private readonly colours: Float32Array;
  private readonly ages: Float32Array;
  private next = 0;
  private readonly last = new Map<EntityId, LastPrints>();

  constructor(scene: Scene) {
    const { capacity, width, length } = TREAD_MARKS;
    this.mesh = MeshBuilder.CreateGround('tread-marks', { width, height: length }, scene);
    const material = new StandardMaterial('tread-mark-mat', scene);
    material.diffuseColor = new Color3(0.08, 0.075, 0.07);
    material.specularColor = Color3.Black();
    // Below 1 so Babylon blends; the per-print colour alpha does the real fading.
    material.alpha = 0.999;
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.hasVertexAlpha = true;
    // Prints are scattered across the arena (and parked below it when unused), so the
    // mesh's own bounding box means nothing: never cull it.
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.matrices = new Float32Array(capacity * 16);
    this.colours = new Float32Array(capacity * 4);
    this.ages = new Float32Array(capacity).fill(Number.POSITIVE_INFINITY);
    // Park every print out of sight until it is used.
    const hidden = Matrix.Translation(0, -100, 0);
    for (let i = 0; i < capacity; i++) {
      hidden.copyToArray(this.matrices, i * 16);
    }
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer('color', this.colours, 4, false);
  }

  /** Once per frame with the tanks as drawn: lay prints where a track has moved far enough, fade the rest. */
  update(tanks: readonly TrackedTank[], frameSeconds: number): void {
    let laid = false;
    const live = new Set<EntityId>();
    for (const tank of tanks) {
      live.add(tank.id);
      const now = trackPoints(tank.position, tank.heading, tank.trackOffset);
      const last = this.last.get(tank.id);
      if (last === undefined) {
        this.last.set(tank.id, { left: now.left, right: now.right });
        continue;
      }
      for (const side of ['left', 'right'] as const) {
        if (distance(last[side], now[side]) >= TREAD_MARKS.spacing) {
          this.lay(now[side], tank.heading);
          last[side] = now[side];
          laid = true;
        }
      }
    }
    for (const id of this.last.keys()) {
      if (!live.has(id)) {
        this.last.delete(id);
      }
    }
    this.fade(frameSeconds);
    if (laid) {
      this.mesh.thinInstanceBufferUpdated('matrix');
    }
    this.mesh.thinInstanceBufferUpdated('color');
  }

  clear(): void {
    this.ages.fill(Number.POSITIVE_INFINITY);
    this.colours.fill(0);
    this.last.clear();
    this.mesh.thinInstanceBufferUpdated('color');
  }

  dispose(): void {
    this.mesh.dispose(false, true);
  }

  private lay(point: GroundPoint, heading: number): void {
    const i = this.next;
    this.next = (this.next + 1) % TREAD_MARKS.capacity;
    const position = toBabylonPosition(new Vec2(point.x, point.z), HEIGHT);
    const rotation = Quaternion.RotationYawPitchRoll(toBabylonRotationY(heading), 0, 0);
    Matrix.Compose(Vector3.One(), rotation, position).copyToArray(this.matrices, i * 16);
    this.ages[i] = 0;
  }

  private fade(frameSeconds: number): void {
    const { opacity, hold, fade } = TREAD_MARKS;
    for (let i = 0; i < TREAD_MARKS.capacity; i++) {
      const age = (this.ages[i] ?? Number.POSITIVE_INFINITY) + frameSeconds;
      this.ages[i] = age;
      const alpha = Number.isFinite(age) ? markOpacity(age, opacity, hold, fade) : 0;
      this.colours.set([1, 1, 1, alpha], i * 4);
    }
  }
}

function distance(a: GroundPoint, b: GroundPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
