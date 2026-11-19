import type { Transform } from './Transform';

/** Stable identifier for an entity, unique within one `World`. Assigned from 1 upward. */
export type EntityId = number;

/** Plain-number state of one entity, for determinism checks and debugging. */
export interface EntitySnapshot {
  readonly id: EntityId;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/**
 * Anything that exists in the simulation world. The only base class in the sim
 * (CLAUDE.md rule 7): `Vehicle`, `Projectile` and `Prop` extend it one level.
 *
 * Holds the transform for the current and the previous tick, so the renderer
 * can interpolate between them. Behavior lives in the systems `Simulation.tick`
 * runs, not in a generic per-entity `update`, so the order things happen in a
 * tick is explicit in one place.
 */
export abstract class Entity {
  private assignedId: EntityId | undefined;
  private current: Transform;
  private previous: Transform;

  constructor(transform: Transform) {
    this.current = transform;
    this.previous = transform;
  }

  /** Throws if read before `World.add`: an entity outside a world has no identity. */
  get id(): EntityId {
    if (this.assignedId === undefined) {
      throw new Error('Entity has no id until it is added to a World');
    }
    return this.assignedId;
  }

  get transform(): Transform {
    return this.current;
  }

  /** The transform at the end of the previous tick; the renderer lerps from here. */
  get previousTransform(): Transform {
    return this.previous;
  }

  /** Called once by `World.add`. Throws on a second call, so one entity can't join two worlds. */
  assignId(id: EntityId): void {
    if (this.assignedId !== undefined) {
      throw new Error(`Entity already has id ${this.assignedId}`);
    }
    this.assignedId = id;
  }

  /** Called by `Simulation` at the start of each tick, before anything moves. */
  saveTransform(): void {
    this.previous = this.current;
  }

  /** Subclasses may add their own state fields when they have some worth comparing. */
  snapshot(): EntitySnapshot {
    const { position, heading } = this.current;
    return { id: this.id, x: position.x, z: position.z, heading };
  }

  protected setTransform(transform: Transform): void {
    this.current = transform;
  }
}
