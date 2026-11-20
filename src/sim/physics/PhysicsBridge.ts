import { Prop } from '../arena/Prop';
import type { Entity, EntityId } from '../core/Entity';
import type { World } from '../core/World';
import { Vehicle } from '../vehicles/Vehicle';
import type { BodyHandle, PhysicsWorld } from './PhysicsWorld';

/**
 * Keeps one physics body per collidable entity, the sim's counterpart of the
 * render layer's `RenderBridge`: each tick it diffs the world's ids against its
 * bodies instead of listening to spawn/destroy events, so bodies can't drift
 * out of step with entities.
 *
 * Collision shapes come from sim data (vehicle hull, prop size), never from
 * meshes (CLAUDE.md rule 5).
 */
export class PhysicsBridge {
  private readonly bodies = new Map<EntityId, BodyHandle>();

  constructor(private readonly physics: PhysicsWorld) {}

  /** Adds bodies for new vehicles and props, and removes bodies whose entity has left the world. */
  sync(world: World): void {
    const live = new Set<EntityId>();
    for (const entity of world.all()) {
      if (!this.bodies.has(entity.id)) {
        const handle = this.createBody(entity);
        if (handle === undefined) {
          continue;
        }
        this.bodies.set(entity.id, handle);
      }
      live.add(entity.id);
    }
    for (const [id, handle] of this.bodies) {
      if (!live.has(id)) {
        this.physics.removeBody(handle);
        this.bodies.delete(id);
      }
    }
  }

  /** Hands each vehicle's locomotion velocities to physics for the coming step. */
  pushVelocities(vehicles: readonly Vehicle[]): void {
    for (const vehicle of vehicles) {
      this.physics.setVelocity(
        this.handleOf(vehicle),
        vehicle.linearVelocity,
        vehicle.angularVelocity,
      );
    }
  }

  /** Copies where physics moved each vehicle (after contacts) back onto the vehicle. */
  pullState(vehicles: readonly Vehicle[]): void {
    for (const vehicle of vehicles) {
      vehicle.syncFromPhysics(this.physics.readBody(this.handleOf(vehicle)));
    }
  }

  /** Number of bodies currently tracked (for tests and debugging). */
  get size(): number {
    return this.bodies.size;
  }

  private createBody(entity: Entity): BodyHandle | undefined {
    if (entity instanceof Vehicle) {
      const { hull, mass } = entity.def;
      return this.physics.addVehicleBody({
        transform: entity.transform,
        length: hull.length,
        width: hull.width,
        mass,
      });
    }
    if (entity instanceof Prop) {
      return this.physics.addStaticBox({
        center: entity.transform.position,
        width: entity.size.width,
        depth: entity.size.depth,
        heading: entity.transform.heading,
      });
    }
    return undefined;
  }

  private handleOf(vehicle: Vehicle): BodyHandle {
    const handle = this.bodies.get(vehicle.id);
    if (handle === undefined) {
      throw new Error(`Vehicle ${vehicle.id} has no physics body; call sync first`);
    }
    return handle;
  }
}
