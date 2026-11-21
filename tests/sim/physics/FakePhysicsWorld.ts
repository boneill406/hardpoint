import { wrapAngle } from '../../../src/sim/core/angles';
import { Vec2 } from '../../../src/sim/core/Vec2';
import type {
  BodyHandle,
  BodyState,
  CastHit,
  ColliderHandle,
  ContactReport,
  PhysicsWorld,
  Segment,
  StaticBoxSpec,
  VehicleBodySpec,
} from '../../../src/sim/physics/PhysicsWorld';

/**
 * A physics world with no collisions: vehicle bodies just move by their
 * velocity each step. Records calls, so tests can check how the sim drives
 * physics without depending on Rapier's contact solving.
 */
export class FakePhysicsWorld implements PhysicsWorld {
  readonly steps: number[] = [];
  readonly staticBoxes: StaticBoxSpec[] = [];
  readonly removed: BodyHandle[] = [];
  disposed = false;
  /** What `contacts()` reports after the next step; tests set it to simulate collisions. */
  nextContacts: ContactReport[] = [];
  private lastContacts: ContactReport[] = [];
  private readonly vehicles = new Map<BodyHandle, BodyState>();
  private nextHandle: BodyHandle = 1;

  step(dt: number): void {
    this.steps.push(dt);
    this.lastContacts = this.nextContacts;
    this.nextContacts = [];
    for (const [handle, state] of this.vehicles) {
      const { position, heading } = state.transform;
      this.vehicles.set(handle, {
        ...state,
        transform: {
          position: position.add(state.linearVelocity.scale(dt)),
          heading: wrapAngle(heading + state.angularVelocity * dt),
        },
      });
    }
  }

  addStaticBox(spec: StaticBoxSpec): BodyHandle {
    this.staticBoxes.push(spec);
    return this.nextHandle++;
  }

  addVehicleBody(spec: VehicleBodySpec): BodyHandle {
    const handle = this.nextHandle++;
    this.vehicles.set(handle, {
      transform: spec.transform,
      linearVelocity: Vec2.ZERO,
      angularVelocity: 0,
    });
    return handle;
  }

  setVelocity(handle: BodyHandle, linear: Vec2, angular: number): void {
    this.vehicles.set(handle, {
      ...this.readBody(handle),
      linearVelocity: linear,
      angularVelocity: angular,
    });
  }

  readBody(handle: BodyHandle): BodyState {
    const state = this.vehicles.get(handle);
    if (state === undefined) {
      throw new Error(`No fake vehicle body ${handle}`);
    }
    return state;
  }

  /** Barrel segments as last set, by collider handle. */
  readonly barrels = new Map<ColliderHandle, Segment>();

  addBarrel(_body: BodyHandle, segment: Segment): ColliderHandle {
    const handle = this.nextHandle++;
    this.barrels.set(handle, segment);
    return handle;
  }

  setBarrel(collider: ColliderHandle, segment: Segment): void {
    this.barrels.set(collider, segment);
  }

  /** No shapes, so nothing ever overlaps: turrets never stall in fake-physics tests. */
  overlaps(): boolean {
    return false;
  }

  /** The fake has no shapes, so casts never hit; collision is tested with real Rapier. */
  castCircle(): CastHit | undefined {
    return undefined;
  }

  contacts(): readonly ContactReport[] {
    return this.lastContacts;
  }

  removeBody(handle: BodyHandle): void {
    this.removed.push(handle);
    this.vehicles.delete(handle);
  }

  dispose(): void {
    this.disposed = true;
  }

  /** Vehicle bodies currently alive. */
  get vehicleCount(): number {
    return this.vehicles.size;
  }
}
