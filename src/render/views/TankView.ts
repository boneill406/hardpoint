import type { Scene } from '@babylonjs/core';
import { lerpAngle, wrapAngle } from '../../sim/core/angles';
import { TICK_SECONDS } from '../../sim/core/time';
import type { Transform } from '../../sim/core/Transform';
import { Vec2 } from '../../sim/core/Vec2';
import type { Vehicle } from '../../sim/vehicles/Vehicle';
import { toBabylonPosition, toBabylonRotationY } from '../coords';
import type { EntityView, FrameTiming } from './EntityView';
import { PrimitiveTankModel } from './tank/PrimitiveTankModel';
import type { TankModel } from './tank/TankModel';
import {
  pitchTarget,
  stepPitchSpring,
  treadBlur,
  treadSpeeds,
  type SpringState,
} from './tank/tankMotion';

/**
 * A tank on screen (M2-6). Places the model at the interpolated transform, and
 * animates what the sim's motion implies but doesn't model: treads scrolling
 * at their true speeds and the hull pitching on its suspension. Reads the
 * vehicle, never writes it (CLAUDE.md rule 4).
 */
export class TankView implements EntityView {
  private readonly model: TankModel;
  /** How far (u) each track surface has travelled; drives the tread scroll. */
  private leftDistance = 0;
  private rightDistance = 0;
  private pitch: SpringState = { angle: 0, velocity: 0 };

  constructor(
    scene: Scene,
    name: string,
    private readonly vehicle: Vehicle,
  ) {
    this.model = new PrimitiveTankModel(scene, name, vehicle.def, vehicle.faction);
  }

  update(transform: Transform, frame: FrameTiming): void {
    this.model.root.position = toBabylonPosition(transform.position);
    this.model.root.rotation.y = toBabylonRotationY(transform.heading);
    this.aimTurret(transform.heading, frame.alpha);
    this.animateTreads(frame.seconds);
    this.animatePitch(frame.seconds);
  }

  dispose(): void {
    this.model.dispose();
  }

  /**
   * The sim's turret heading is in world terms (stabilised); the model's turret
   * sits on the hull, so it gets the difference from the drawn hull heading.
   */
  private aimTurret(hullHeading: number, alpha: number): void {
    const { turret } = this.vehicle;
    const world = lerpAngle(turret.previousHeading, turret.heading, alpha);
    this.model.turret.rotation.y = toBabylonRotationY(wrapAngle(world - hullHeading));
  }

  /** Speeds come from the sim's motion after physics: a pinned or shoved tank's tracks don't turn. */
  private animateTreads(frameSeconds: number): void {
    const forward = Vec2.fromHeading(this.vehicle.transform.heading);
    const speeds = treadSpeeds(
      this.vehicle.linearVelocity.dot(forward),
      this.vehicle.angularVelocity,
      this.model.halfTrackSpacing,
    );
    this.leftDistance += speeds.left * frameSeconds;
    this.rightDistance += speeds.right * frameSeconds;

    const { leftTread, rightTread, treadPeriod } = this.model;
    leftTread.scrollTo(this.leftDistance);
    rightTread.scrollTo(this.rightDistance);
    leftTread.setBlur(treadBlur(speeds.left, frameSeconds, treadPeriod));
    rightTread.setBlur(treadBlur(speeds.right, frameSeconds, treadPeriod));
  }

  /** Acceleration over the last tick (stable, unlike per-frame differences) tips the hull. */
  private animatePitch(frameSeconds: number): void {
    const forward = Vec2.fromHeading(this.vehicle.transform.heading);
    const change = this.vehicle.linearVelocity.sub(this.vehicle.previousLinearVelocity);
    const acceleration = change.dot(forward) / TICK_SECONDS;
    this.pitch = stepPitchSpring(this.pitch, pitchTarget(acceleration), frameSeconds);
    this.model.hull.rotation.x = this.pitch.angle;
  }
}
