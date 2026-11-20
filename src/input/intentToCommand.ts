import { angleDelta, degToRad } from '../sim/core/angles';
import { clamp } from '../sim/core/scalar';
import type { Transform } from '../sim/core/Transform';
import type { Vec2 } from '../sim/core/Vec2';
import type { VehicleCommand } from '../sim/vehicles/VehicleCommand';
import type { AimIntent, DriveIntent, PlayerIntent } from './PlayerIntent';

/** Stick aim becomes a ground point this far from the tank (u). Far enough that turret aim is stable. */
const STICK_AIM_DISTANCE = 8;
/** `direct` driving: the heading error (and above) at which the tank turns at full rate. */
const DIRECT_FULL_TURN_ANGLE = degToRad(30);

/**
 * Turns a device-level intent into the sim's `VehicleCommand`. Runs in the app
 * layer, before the tick, reading (never writing) the player tank's transform:
 * stick aim and `direct` driving are relative to where the tank is and faces.
 *
 * With no aim (stick released, cursor off the ground) the command has no aim
 * point, and the stabilised turret holds its heading.
 */
export function intentToCommand(intent: PlayerIntent, tank: Transform): VehicleCommand {
  const { throttle, turn } = driveToThrottleTurn(intent.drive, tank.heading);
  return {
    throttle,
    turn,
    aimPoint: aimToPoint(intent.aim, tank.position),
    firePrimary: intent.firePrimary,
    fireSecondary: intent.fireSecondary,
  };
}

function driveToThrottleTurn(
  drive: DriveIntent,
  heading: number,
): { throttle: number; turn: number } {
  if (drive.kind === 'tank') {
    return { throttle: drive.throttle, turn: drive.turn };
  }
  const strength = Math.min(1, drive.direction.length());
  if (strength === 0) {
    return { throttle: 0, turn: 0 };
  }
  // Turn toward the stick direction; drive forward only as far as the hull already faces it,
  // so a target behind the tank makes it pivot first instead of driving off the wrong way.
  const error = angleDelta(heading, drive.direction.heading());
  return {
    throttle: strength * Math.max(0, Math.cos(error)),
    turn: clamp(error / DIRECT_FULL_TURN_ANGLE, -1, 1),
  };
}

function aimToPoint(aim: AimIntent, tankPosition: Vec2): Vec2 | undefined {
  switch (aim.kind) {
    case 'point':
      return aim.point;
    case 'direction':
      return tankPosition.add(aim.direction.normalize().scale(STICK_AIM_DISTANCE));
    case 'none':
      return undefined;
  }
}
