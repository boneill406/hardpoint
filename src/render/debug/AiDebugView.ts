import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { LinesMesh, Mesh, Scene } from '@babylonjs/core';
import type { EntityId } from '../../sim/core/Entity';
import type { Vec2 } from '../../sim/core/Vec2';
import { AiController } from '../../sim/vehicles/controllers/AiController';
import type { Vehicle } from '../../sim/vehicles/Vehicle';
import { toBabylonPosition } from '../coords';

const HEIGHT = 0.06;
const PATH_COLOR = new Color3(0.4, 0.85, 1);

interface Marks {
  path: LinesMesh | undefined;
  readonly spot: Mesh;
}

/**
 * Debug view (`?ai=on`, M4 plan D15): each AI tank's remaining path as a line
 * on the floor and its chosen firing spot as a ring. Reads the controller's
 * `debug` snapshot; never touches the sim. The path line is rebuilt every
 * frame, which is fine for a handful of debug tanks.
 */
export class AiDebugView {
  private readonly marks = new Map<EntityId, Marks>();
  private readonly spotMaterial: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.spotMaterial = new StandardMaterial('ai-spot-mat', scene);
    this.spotMaterial.emissiveColor = PATH_COLOR;
    this.spotMaterial.disableLighting = true;
  }

  update(vehicles: readonly Vehicle[]): void {
    const live = new Set<EntityId>();
    for (const vehicle of vehicles) {
      if (!(vehicle.controller instanceof AiController)) {
        continue;
      }
      live.add(vehicle.id);
      const { path, spot } = vehicle.controller.debug;
      const marks = this.marksFor(vehicle.id);
      marks.path?.dispose();
      marks.path = this.line([vehicle.transform.position, ...path]);
      marks.spot.isVisible = spot !== undefined;
      if (spot !== undefined) {
        marks.spot.position = toBabylonPosition(spot, HEIGHT);
      }
    }
    for (const [id, marks] of this.marks) {
      if (!live.has(id)) {
        marks.path?.dispose();
        marks.spot.dispose();
        this.marks.delete(id);
      }
    }
  }

  dispose(): void {
    for (const marks of this.marks.values()) {
      marks.path?.dispose();
      marks.spot.dispose();
    }
    this.marks.clear();
    this.spotMaterial.dispose();
  }

  private line(points: readonly Vec2[]): LinesMesh | undefined {
    if (points.length < 2) {
      return undefined;
    }
    const lines = MeshBuilder.CreateLines(
      'ai-path',
      { points: points.map((point) => toBabylonPosition(point, HEIGHT)) },
      this.scene,
    );
    lines.color = PATH_COLOR;
    lines.isPickable = false;
    return lines;
  }

  private marksFor(id: EntityId): Marks {
    const existing = this.marks.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const spot = MeshBuilder.CreateTorus(
      `ai-spot-${id}`,
      { diameter: 1.2, thickness: 0.08, tessellation: 24 },
      this.scene,
    );
    spot.material = this.spotMaterial;
    spot.isPickable = false;
    const marks: Marks = { path: undefined, spot };
    this.marks.set(id, marks);
    return marks;
  }
}
