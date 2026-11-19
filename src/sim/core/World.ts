import type { Entity, EntityId } from './Entity';
import type { EventBus } from './EventBus';
import type { SimEvents } from './SimEvents';

/** Any entity class, including abstract ones such as `Entity` itself. */
type EntityClass<T extends Entity> = abstract new (...args: never[]) => T;

/**
 * The set of live entities. Iteration is always in insertion order, never hash
 * or object order, so the same inputs visit entities in the same order (M1-7).
 *
 * Removal is deferred to the end of the tick: a tank destroyed by the first
 * shell of a tick is still there for the rest of it, so systems never iterate
 * over a list that shrinks under them, and every system sees the same world.
 */
export class World {
  private readonly entities = new Map<EntityId, Entity>();
  private readonly pendingRemovals = new Set<EntityId>();
  private nextId: EntityId = 1;

  constructor(private readonly events: EventBus<SimEvents>) {}

  /** Adds an entity immediately, gives it the next id and queues `EntitySpawned`. */
  add<T extends Entity>(entity: T): T {
    const id = this.nextId++;
    entity.assignId(id);
    this.entities.set(id, entity);
    this.events.emit('EntitySpawned', { id });
    return entity;
  }

  /** Marks an entity for removal at the end of the tick. Unknown or already-marked ids are ignored. */
  remove(id: EntityId): void {
    if (this.entities.has(id)) {
      this.pendingRemovals.add(id);
    }
  }

  get(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /** Every entity, in insertion order. A copy, so adding during iteration is safe. */
  all(): Entity[] {
    return [...this.entities.values()];
  }

  /** Entities that are instances of `type` (subclasses included), in insertion order. */
  ofType<T extends Entity>(type: EntityClass<T>): T[] {
    const matches: T[] = [];
    for (const entity of this.entities.values()) {
      if (entity instanceof type) {
        matches.push(entity);
      }
    }
    return matches;
  }

  /** Called by `Simulation` at the end of each tick. Queues `EntityDestroyed` in removal order. */
  applyRemovals(): void {
    for (const id of this.pendingRemovals) {
      this.entities.delete(id);
      this.events.emit('EntityDestroyed', { id });
    }
    this.pendingRemovals.clear();
  }
}
