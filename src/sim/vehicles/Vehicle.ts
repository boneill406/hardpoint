import { WeaponMount, type Shot } from '../combat/WeaponMount';
import { wrapAngle } from '../core/angles';
import { Entity, type EntitySnapshot } from '../core/Entity';
import type { Rng } from '../core/Rng';
import type { Transform } from '../core/Transform';
import { Vec2 } from '../core/Vec2';
import type { BodyState } from '../physics/PhysicsWorld';
import type { Controller } from './controllers/Controller';
import type { Faction } from './Faction';
import type { Locomotion, LocomotionSnapshot } from './locomotion/Locomotion';
import { Turret, type TurretSnapshot } from './Turret';
import { IDLE_COMMAND, type VehicleCommand } from './VehicleCommand';
import type { VehicleDef } from './VehicleDef';

/** Vehicle state worth comparing in determinism checks, on top of the transform. */
export interface VehicleSnapshot extends EntitySnapshot {
  readonly vx: number;
  readonly vz: number;
  readonly angularVelocity: number;
  readonly locomotion: LocomotionSnapshot;
  readonly turret: TurretSnapshot;
  /** Per weapon mount, each limiter's state. */
  readonly weapons: readonly (readonly Readonly<Record<string, number>>[])[];
}

/**
 * Any tank (or later, walker) in the world: the player's and the enemies' are
 * the same class with a different def, faction and controller
 * (architecture.md §4). Behavior is composed: `Controller` decides,
 * `Locomotion` turns the decision into velocity.
 *
 * Build one with `createVehicle` (VehicleFactory.ts), not directly.
 */
export class Vehicle extends Entity {
  /** Aims independently of the hull (stabilised). */
  readonly turret: Turret;
  /** Guns on the turret, in def order. */
  readonly mounts: readonly WeaponMount[];
  private linear = Vec2.ZERO;
  private previousLinear = Vec2.ZERO;
  private angular = 0;
  private activeCommand: VehicleCommand = IDLE_COMMAND;

  constructor(
    transform: Transform,
    readonly def: VehicleDef,
    readonly faction: Faction,
    readonly controller: Controller,
    private readonly locomotion: Locomotion,
  ) {
    super(transform);
    this.turret = new Turret(def.turret, transform.heading);
    this.mounts = def.hardpoints.flatMap((hardpoint) => {
      const weapon = def.loadout[hardpoint.id];
      return weapon === undefined ? [] : [new WeaponMount(hardpoint, weapon)];
    });
  }

  /** World-space velocity, u/s. */
  get linearVelocity(): Vec2 {
    return this.linear;
  }

  /**
   * Velocity at the end of the previous tick. With `linearVelocity` it gives
   * this tick's acceleration, which the render layer uses for hull pitch.
   */
  get previousLinearVelocity(): Vec2 {
    return this.previousLinear;
  }

  /** rad/s; positive turns clockwise seen from above. */
  get angularVelocity(): number {
    return this.angular;
  }

  /** The command this tick's movement and firing follow. */
  get command(): VehicleCommand {
    return this.activeCommand;
  }

  /** Tick phase 1: keeps last tick's velocity alongside last tick's transform. */
  override saveTransform(): void {
    super.saveTransform();
    this.previousLinear = this.linear;
    this.turret.saveHeading();
    for (const mount of this.mounts) {
      mount.saveClearance();
    }
  }

  /** Tick phase 2: store what the controller decided. */
  applyCommand(command: VehicleCommand): void {
    this.activeCommand = command;
  }

  /** Tick phase 3: let locomotion update velocity toward the command. */
  drive(dt: number): void {
    const velocities = this.locomotion.step(
      this.activeCommand,
      {
        heading: this.transform.heading,
        linearVelocity: this.linear,
        angularVelocity: this.angular,
      },
      dt,
    );
    this.linear = velocities.linear;
    this.angular = velocities.angular;
  }

  /**
   * Tick phase 4, after the physics step: take the transform and velocities
   * physics produced. Contacts may have stopped, slid or pushed the vehicle, and
   * locomotion starts the next tick from what really happened.
   */
  syncFromPhysics(state: BodyState): void {
    this.setTransform({
      position: state.transform.position,
      heading: wrapAngle(state.transform.heading),
    });
    this.linear = state.linearVelocity;
    this.angular = state.angularVelocity;
  }

  /**
   * Tick phase 5, after physics: traverse the turret toward the command's aim,
   * measured from the turret's pivot so the gun line passes through the aim point.
   */
  aimTurret(dt: number): void {
    this.turret.step(this.activeCommand.aimPoint, this.turretPivot(), dt);
  }

  /** Where the turret pivots now: on the hull's centreline, `pivotForward` from its centre. */
  turretPivot(): Vec2 {
    const { position, heading } = this.transform;
    return position.add(Vec2.fromHeading(heading).scale(this.def.turret.pivotForward));
  }

  /**
   * Tick phase 6, after the turret has aimed: each weapon's limiters advance,
   * and every weapon whose trigger is held and whose limiters allow it fires.
   * Spread comes from the simulation's `Rng`, in a fixed order (vehicles in
   * world order, hardpoints in def order), so it replays identically.
   */
  fireWeapons(dt: number, rng: Rng): Shot[] {
    const shots: Shot[] = [];
    for (const mount of this.mounts) {
      const held =
        mount.hardpoint.trigger === 'primary'
          ? this.activeCommand.firePrimary
          : this.activeCommand.fireSecondary;
      mount.weapon.update(dt, held);
      if (held && mount.weapon.tryFire()) {
        shots.push({
          mount,
          origin: this.clearMuzzlePosition(mount),
          heading: this.shotHeading(mount, rng),
        });
        mount.advanceMuzzle();
      }
    }
    return shots;
  }

  /** Where a hardpoint's frame starts: the turret pivot for turret hardpoints, the hull centre for hull ones. */
  mountOrigin(mount: WeaponMount): Vec2 {
    return mount.hardpoint.on === 'turret' ? this.turretPivot() : this.transform.position;
  }

  /** Which way a hardpoint faces: with the turret's aim, or straight along the hull. */
  mountFacing(mount: WeaponMount): number {
    return mount.hardpoint.on === 'turret' ? this.turret.heading : this.transform.heading;
  }

  /** Where `mount`'s (next) muzzle is now: its frame origin plus the muzzle offset along its facing. */
  muzzlePosition(mount: WeaponMount): Vec2 {
    const facing = this.mountFacing(mount);
    const { forward, right } = mount.muzzleOffset;
    return this.mountOrigin(mount)
      .add(Vec2.fromHeading(facing).scale(forward))
      .add(Vec2.fromHeading(facing + Math.PI / 2).scale(right));
  }

  /**
   * Where a shot from `mount` actually starts: the muzzle, or, if the barrel
   * is pressed against something, the point where the origin→muzzle line
   * meets it, so the shot hits that obstacle at once instead of starting
   * inside or behind it (M3-7).
   */
  clearMuzzlePosition(mount: WeaponMount): Vec2 {
    return this.mountOrigin(mount).lerp(this.muzzlePosition(mount), mount.clearance);
  }

  private shotHeading(mount: WeaponMount, rng: Rng): number {
    const { spread } = mount.weapon.def;
    // No draw for accurate weapons, so adding the cannon doesn't shift everyone else's spread.
    const offset = spread > 0 ? rng.range(-spread / 2, spread / 2) : 0;
    return wrapAngle(this.mountFacing(mount) + offset);
  }

  override snapshot(): VehicleSnapshot {
    return {
      ...super.snapshot(),
      vx: this.linear.x,
      vz: this.linear.z,
      angularVelocity: this.angular,
      locomotion: this.locomotion.snapshot(),
      turret: this.turret.snapshot(),
      weapons: this.mounts.map((mount) => mount.snapshot()),
    };
  }
}
