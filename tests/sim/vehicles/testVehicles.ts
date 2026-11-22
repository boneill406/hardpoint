import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { TANK_ARMOR } from '../../../src/sim/defs/armor';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import type { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import type { TrackedLocomotionDef, VehicleDef } from '../../../src/sim/vehicles/VehicleDef';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';

/** Round numbers so expected values are easy to work out by hand. Not the game's tuning. */
export const TEST_LOCOMOTION: TrackedLocomotionDef = {
  kind: 'tracked',
  topSpeed: 10,
  reverseFactor: 0.5,
  accelTime: 0.5,
  stopTime: 0.25,
  shiftTime: 0.2,
  turnRate: 2,
  turnAccelTime: 0.1,
  grip: 40,
};

export const TEST_TANK: VehicleDef = {
  name: 'Test tank',
  mass: 10,
  hull: { length: 2, width: 1 },
  health: 100,
  armor: TANK_ARMOR,
  locomotion: TEST_LOCOMOTION,
  turret: {
    traverseRate: 3,
    spinUpTime: 0.05,
    snapAngle: 0.02,
    minAimDistance: 1,
    pivotForward: 0,
  },
  hardpoints: [],
  loadout: {},
};

export const AT_ORIGIN: Transform = { position: Vec2.ZERO, heading: 0 };

/** A command with only throttle and turn set. */
export function drive(throttle: number, turn = 0): VehicleCommand {
  return { ...IDLE_COMMAND, throttle, turn };
}

/** A test tank that always follows `command`. */
export function scriptedTank(command: VehicleCommand, transform = AT_ORIGIN): Vehicle {
  return createVehicle(TEST_TANK, {
    transform,
    faction: 'player',
    controller: new ScriptedController(() => command),
  });
}

/** The same tank with no weapons fitted: hull-only collision, for tests about the hull. */
export function bareHull(def: VehicleDef): VehicleDef {
  return { ...def, loadout: {} };
}

/** The same tank with its barrels made non-solid: for tests of the muzzle-clearance safety net. */
export function nonCollidingBarrels(def: VehicleDef): VehicleDef {
  const loadout = Object.fromEntries(
    Object.entries(def.loadout).map(([id, weapon]) => [
      id,
      { ...weapon, barrel: { ...weapon.barrel, collides: false } },
    ]),
  );
  return { ...def, loadout };
}
