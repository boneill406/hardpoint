import type { Scene } from '@babylonjs/core';
import { lerpAngle } from '../sim/core/angles';
import type { Entity, EntityId } from '../sim/core/Entity';
import type { Transform } from '../sim/core/Transform';
import { Vehicle } from '../sim/vehicles/Vehicle';
import type { EntityView } from './views/EntityView';
import { VehicleView } from './views/VehicleView';

export interface RenderBridgeOptions {
  /** false draws the latest tick as is (debug `?interp=off`), to show the stutter interpolation hides. */
  readonly interpolate: boolean;
}

/**
 * Keeps one view per simulation entity and places each view every frame.
 *
 * It diffs the world's ids against its views each frame instead of listening to
 * spawn/destroy events, so views can never get out of step with the world (no
 * missed or doubled event); the cost is one pass over all entities per frame.
 *
 * Positions are interpolated between the last two ticks with `alpha` from
 * `FixedClock`, so motion is smooth at any frame rate, one tick behind the sim.
 */
export class RenderBridge {
  private readonly views = new Map<EntityId, EntityView>();

  constructor(
    private readonly scene: Scene,
    private readonly options: RenderBridgeOptions,
  ) {}

  /** Creates views for new entities, disposes views of removed ones, and places the rest. */
  sync(entities: readonly Entity[], alpha: number): void {
    const live = new Set<EntityId>();
    for (const entity of entities) {
      live.add(entity.id);
      this.viewFor(entity).update(this.transformToDraw(entity, alpha));
    }
    for (const [id, view] of this.views) {
      if (!live.has(id)) {
        view.dispose();
        this.views.delete(id);
      }
    }
  }

  dispose(): void {
    for (const view of this.views.values()) {
      view.dispose();
    }
    this.views.clear();
  }

  private viewFor(entity: Entity): EntityView {
    let view = this.views.get(entity.id);
    if (view === undefined) {
      view = this.createView(entity);
      this.views.set(entity.id, view);
    }
    return view;
  }

  /** Throws for an entity type with no view: every entity must be visible, so this is a bug. */
  private createView(entity: Entity): EntityView {
    if (entity instanceof Vehicle) {
      return new VehicleView(this.scene, `vehicle-${entity.id}`, entity.def.hull, entity.faction);
    }
    throw new Error(`No view for entity ${entity.id} (${entity.constructor.name})`);
  }

  private transformToDraw(entity: Entity, alpha: number): Transform {
    if (!this.options.interpolate) {
      return entity.transform;
    }
    return interpolate(entity.previousTransform, entity.transform, alpha);
  }
}

/** Blends two transforms: position in a straight line, heading along the shortest arc. */
function interpolate(previous: Transform, current: Transform, alpha: number): Transform {
  return {
    position: previous.position.lerp(current.position, alpha),
    heading: lerpAngle(previous.heading, current.heading, alpha),
  };
}
