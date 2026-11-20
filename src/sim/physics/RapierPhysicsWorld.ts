import RAPIER from '@dimforge/rapier2d-compat';
import { wrapAngle } from '../core/angles';
import { Vec2 } from '../core/Vec2';
import type {
  BodyHandle,
  BodyState,
  PhysicsWorld,
  StaticBoxSpec,
  VehicleBodySpec,
} from './PhysicsWorld';

/** Shared across worlds: the WASM module only needs to load once per page/process. */
let wasmReady: Promise<void> | undefined;

/**
 * How close (u) two shapes must be before Rapier creates a contact for them.
 * Must exceed the furthest any body moves in one tick (top speed 7 u/s × 1/60 s
 * ≈ 0.12 u): otherwise a tank arriving at full speed has no contact yet on the
 * tick it hits and sinks into the obstacle (≈ 0.06 u measured with Rapier's
 * default 0.02) before being pushed out. Guarded by a test against the defs.
 */
export const CONTACT_PREDICTION_DISTANCE = 0.15;

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
    this.world.step();
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
        .setRestitution(0),
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

  removeBody(handle: BodyHandle): void {
    this.world.removeRigidBody(this.body(handle));
  }

  dispose(): void {
    this.world.free();
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
