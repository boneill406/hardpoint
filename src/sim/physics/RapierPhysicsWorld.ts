import RAPIER from '@dimforge/rapier2d-compat';
import { wrapAngle } from '../core/angles';
import { TICK_SECONDS } from '../core/time';
import { Vec2 } from '../core/Vec2';
import { MAX_VEHICLE_SPEED } from '../vehicles/VehicleDef';
import type {
  BodyHandle,
  BodyState,
  CastHit,
  ContactReport,
  PhysicsWorld,
  StaticBoxSpec,
  VehicleBodySpec,
} from './PhysicsWorld';

/** Shared across worlds: the WASM module only needs to load once per page/process. */
let wasmReady: Promise<void> | undefined;

/**
 * How close (u) two shapes must be before Rapier creates a contact for them.
 * Must exceed the furthest two bodies can close on each other in one tick:
 * otherwise a tank arriving at speed has no contact yet on the tick it hits
 * and sinks into the obstacle (≈ 0.06 u measured at 7 u/s with Rapier's
 * default 0.02) before being pushed out. Sized for two vehicles at the speed
 * cap meeting head-on, with 25% margin.
 */
export const CONTACT_PREDICTION_DISTANCE = 2 * MAX_VEHICLE_SPEED * TICK_SECONDS * 1.25;

function loadRapier(): Promise<void> {
  wasmReady ??= RAPIER.init();
  return wasmReady;
}

/**
 * Sim heading → Rapier rotation. Rapier's x/y plane is the sim's (x, z) plane,
 * and a body's local +y is its forward. Rapier rotates +x toward +y (counter-
 * clockwise in its frame) while sim headings turn +z toward +x, so the signs are
 * opposite: rotating local +y by r gives (−sin r, cos r), and forward must be
 * (sin h, cos h), so r = −h. The same flip applies to angular velocity.
 */
function toRapierAngle(heading: number): number {
  return -heading;
}

function fromRapierAngle(rotation: number): number {
  return wrapAngle(-rotation);
}

/**
 * `PhysicsWorld` backed by Rapier 2D (ADR-0005). Rapier's x/y plane is the
 * simulation's ground plane (x, z), so no axis is locked or ignored.
 *
 * Created through the async `create()` because Rapier must load its WASM module
 * before any world can exist.
 *
 * Friction is zero on vehicles: sideways grip is the locomotion's job
 * (`TrackedLocomotion`), and friction against walls would make tanks stick
 * instead of sliding along them.
 */
export class RapierPhysicsWorld implements PhysicsWorld {
  private readonly world: RAPIER.World;
  /** Rapier reports contact forces here during `step`; drained right after. */
  private readonly events = new RAPIER.EventQueue(true);
  private lastContacts: ContactReport[] = [];

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  /** Loads Rapier (first call only) and returns an empty world. */
  static async create(): Promise<RapierPhysicsWorld> {
    await loadRapier();
    // Top-down game: "down" is into the screen, not along the plane, so no gravity.
    const world = new RAPIER.World({ x: 0, y: 0 });
    // lengthUnit is 1 (1 sim unit = 1 Rapier "metre"), so the normalized value is in units.
    world.integrationParameters.normalizedPredictionDistance = CONTACT_PREDICTION_DISTANCE;
    return new RapierPhysicsWorld(world);
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step(this.events);
    this.lastContacts = [];
    this.events.drainContactForceEvents((event) => {
      this.lastContacts.push({
        bodyA: this.bodyOfCollider(event.collider1()),
        bodyB: this.bodyOfCollider(event.collider2()),
        // Rapier reports force (impulse / dt); the sim wants the impulse of this step.
        impulse: event.totalForceMagnitude() * dt,
      });
    });
  }

  contacts(): readonly ContactReport[] {
    return this.lastContacts;
  }

  addStaticBox(spec: StaticBoxSpec): BodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(spec.center.x, spec.center.z)
        .setRotation(toRapierAngle(spec.heading)),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.depth / 2), body);
    return body.handle;
  }

  addVehicleBody(spec: VehicleBodySpec): BodyHandle {
    const { position, heading } = spec.transform;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.z)
        .setRotation(toRapierAngle(heading))
        // Velocity is set every tick; a sleeping body would ignore it.
        .setCanSleep(false),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.length / 2)
        .setMass(spec.mass)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0)
        // Report every pushing contact (threshold 0); PhysicsBridge decides what's an impact.
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(0),
      body,
    );
    return body.handle;
  }

  setVelocity(handle: BodyHandle, linear: Vec2, angular: number): void {
    const body = this.body(handle);
    body.setLinvel({ x: linear.x, y: linear.z }, true);
    body.setAngvel(toRapierAngle(angular), true);
  }

  readBody(handle: BodyHandle): BodyState {
    const body = this.body(handle);
    const translation = body.translation();
    const velocity = body.linvel();
    return {
      transform: {
        position: new Vec2(translation.x, translation.y),
        heading: fromRapierAngle(body.rotation()),
      },
      linearVelocity: new Vec2(velocity.x, velocity.y),
      angularVelocity: -body.angvel(),
    };
  }

  castCircle(from: Vec2, to: Vec2, radius: number, ignore?: BodyHandle): CastHit | undefined {
    const move = to.sub(from);
    const hit = this.world.castShape(
      { x: from.x, y: from.z },
      0,
      // The whole move as a velocity with a time limit of 1: time of impact = fraction of the path.
      { x: move.x, y: move.z },
      new RAPIER.Ball(radius),
      0,
      1,
      true,
      undefined,
      undefined,
      undefined,
      ignore === undefined ? undefined : this.body(ignore),
    );
    if (hit === null) {
      return undefined;
    }
    const body = hit.collider.parent();
    if (body === null) {
      return undefined;
    }
    return {
      body: body.handle,
      point: new Vec2(hit.witness1.x, hit.witness1.y),
      normal: new Vec2(hit.normal1.x, hit.normal1.y),
      fraction: hit.time_of_impact,
    };
  }

  removeBody(handle: BodyHandle): void {
    this.world.removeRigidBody(this.body(handle));
  }

  dispose(): void {
    this.events.free();
    this.world.free();
  }

  private bodyOfCollider(handle: number): BodyHandle {
    const body = this.world.getCollider(handle).parent();
    if (body === null) {
      throw new Error(`Collider ${handle} has no body`);
    }
    return body.handle;
  }

  private body(handle: BodyHandle): RAPIER.RigidBody {
    // Typed as always present, but Rapier returns nothing for a stale handle.
    const body = this.world.getRigidBody(handle) as RAPIER.RigidBody | null | undefined;
    if (body === null || body === undefined) {
      throw new Error(`No physics body with handle ${handle}`);
    }
    return body;
  }
}
