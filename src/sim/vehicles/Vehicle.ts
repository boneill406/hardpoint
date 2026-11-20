import { wrapAngle } from '../core/angles';
import { Entity, type EntitySnapshot } from '../core/Entity';
import type { Transform } from '../core/Transform';
import { Vec2 } from '../core/Vec2';
import type { Controller } from './controllers/Controller';
import type { Faction } from './Faction';
import type { Locomotion, LocomotionSnapshot } from './locomotion/Locomotion';
import { IDLE_COMMAND, type VehicleCommand } from './VehicleCommand';
import type { VehicleDef } from './VehicleDef';

/** Vehicle state worth comparing in determinism checks, on top of the transform. */
export interface VehicleSnapshot extends EntitySnapshot {
  readonly vx: number;
  readonly vz: number;
  readonly angularVelocity: number;
  readonly locomotion: LocomotionSnapshot;
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
  private linear = Vec2.ZERO;
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
  }

  /** World-space velocity, u/s. */
  get linearVelocity(): Vec2 {
    return this.linear;
  }

  /** rad/s; positive turns clockwise seen from above. */
  get angularVelocity(): number {
    return this.angular;
  }

  /** The command this tick's movement and firing follow. */
  get command(): VehicleCommand {
    return this.activeCommand;
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
   * Tick phase 4: move by the current velocities. Temporary: from M2-3 Rapier
   * integrates instead, so contacts can stop and push vehicles.
   */
  integrate(dt: number): void {
    const { position, heading } = this.transform;
    this.setTransform({
      position: position.add(this.linear.scale(dt)),
      heading: wrapAngle(heading + this.angular * dt),
    });
  }

  override snapshot(): VehicleSnapshot {
    return {
      ...super.snapshot(),
      vx: this.linear.x,
      vz: this.linear.z,
      angularVelocity: this.angular,
      locomotion: this.locomotion.snapshot(),
    };
  }
}
