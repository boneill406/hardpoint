import { Prop } from '../arena/Prop';
import type { Entity, EntityId } from '../core/Entity';
import type { World } from '../core/World';
import { Vehicle } from '../vehicles/Vehicle';
import type { BodyHandle, ColliderHandle, PhysicsWorld } from './PhysicsWorld';

/**
 * Keeps one physics body per collidable entity, the sim's counterpart of the
 * render layer's `RenderBridge`: each tick it diffs the world's ids against its
 * bodies instead of listening to spawn/destroy events, so bodies can't drift
 * out of step with entities.
 *
 * Collision shapes come from sim data (vehicle hull, prop size), never from
 * meshes (CLAUDE.md rule 5).
 */
/** A new vehicle-vs-vehicle impact this tick (`a` < `b`, for a stable order). */
export interface VehicleImpact {
  readonly a: EntityId;
  readonly b: EntityId;
  readonly impulse: number;
}

export class PhysicsBridge {
  private readonly bodies = new Map<EntityId, BodyHandle>();
  /** Reverse of `bodies`, for turning physics contacts back into entities. */
  private readonly owners = new Map<BodyHandle, Entity>();
  /** Vehicle pairs that were pushing on each other last tick, as "a:b" keys. */
  private touching = new Set<string>();
  /** Barrel colliders by vehicle id and hardpoint id (M3-8b). */
  private readonly barrels = new Map<EntityId, Map<string, ColliderHandle>>();
  /** Every barrel collider, for telling a barrel hit from a hull hit. */
  private readonly barrelColliders = new Set<ColliderHandle>();

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
        this.owners.set(handle, entity);
        if (entity instanceof Vehicle) {
          this.addBarrels(entity, handle);
        }
      }
      live.add(entity.id);
    }
    for (const [id, handle] of this.bodies) {
      if (!live.has(id)) {
        this.physics.removeBody(handle);
        this.bodies.delete(id);
        this.owners.delete(handle);
        for (const collider of this.barrels.get(id)?.values() ?? []) {
          this.barrelColliders.delete(collider);
        }
        this.barrels.delete(id);
      }
    }
  }

  /** Hands each vehicle's locomotion velocities, and its barrels' current poses, to physics. */
  pushVelocities(vehicles: readonly Vehicle[]): void {
    for (const vehicle of vehicles) {
      this.poseBarrels(vehicle);
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

  /**
   * After a step: vehicle pairs that started touching this step. A pair that
   * keeps shoving isn't reported again until it separates and hits again, so
   * one collision is one event (one clash effect in M6).
   */
  newVehicleImpacts(): VehicleImpact[] {
    const impacts: VehicleImpact[] = [];
    const nowTouching = new Set<string>();
    for (const contact of this.physics.contacts()) {
      const first = this.owners.get(contact.bodyA);
      const second = this.owners.get(contact.bodyB);
      if (!(first instanceof Vehicle) || !(second instanceof Vehicle)) {
        continue;
      }
      const [a, b] = first.id < second.id ? [first.id, second.id] : [second.id, first.id];
      const key = `${a}:${b}`;
      if (!this.touching.has(key) && !nowTouching.has(key)) {
        impacts.push({ a, b, impulse: contact.impulse });
      }
      nowTouching.add(key);
    }
    this.touching = nowTouching;
    return impacts;
  }

  /** Every barrel collider, so physics queries can leave barrels out (they're checked in the sim). */
  get barrelColliderSet(): ReadonlySet<ColliderHandle> {
    return this.barrelColliders;
  }

  /** True if a collider is a gun barrel (shots stop there but deal no damage, plan D17). */
  isBarrel(collider: ColliderHandle): boolean {
    return this.barrelColliders.has(collider);
  }

  /** The body of an entity, if it has one (to exclude a shooter from its own shots). */
  bodyOf(id: EntityId): BodyHandle | undefined {
    return this.bodies.get(id);
  }

  /** The entity that owns a body, or undefined for walls (bodies without an entity). */
  entityOf(handle: BodyHandle): Entity | undefined {
    return this.owners.get(handle);
  }

  /** Number of bodies currently tracked (for tests and debugging). */
  get size(): number {
    return this.bodies.size;
  }

  /** One massless capsule per fitted barrel that collides (plan D15). */
  private addBarrels(vehicle: Vehicle, body: BodyHandle): void {
    const byHardpoint = new Map<string, ColliderHandle>();
    for (const mount of vehicle.mounts) {
      if (mount.weapon.def.barrel.collides) {
        const collider = this.physics.addBarrel(body, vehicle.barrelSegment(mount));
        byHardpoint.set(mount.hardpoint.id, collider);
        this.barrelColliders.add(collider);
      }
    }
    this.barrels.set(vehicle.id, byHardpoint);
  }

  /** Re-poses a vehicle's barrels to the turret's current heading before the step. */
  private poseBarrels(vehicle: Vehicle): void {
    const byHardpoint = this.barrels.get(vehicle.id);
    if (byHardpoint === undefined) {
      return;
    }
    for (const mount of vehicle.mounts) {
      const collider = byHardpoint.get(mount.hardpoint.id);
      if (collider !== undefined) {
        this.physics.setBarrel(collider, vehicle.barrelSegment(mount));
      }
    }
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
