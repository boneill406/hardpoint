import { degToRad } from '../core/angles';
import type { HardpointDef, VehicleDef } from '../vehicles/VehicleDef';
import { TANK_ARMOR } from './armor';
import { CANNON, INSURGENT_CANNON, MACHINE_GUN } from './weapons';

// Vehicle tuning (GDD §3, §5; M2 plan D3, D4). Starting values: edit and save,
// and Vite reloads the game with the new numbers.

/** Turret pivot, matching the primitive model (M2-6). */
const TURRET_PIVOT_FORWARD = -0.05;

/** The main gun's hardpoint: the mantlet front, centred. With the cannon's 1.05 barrel, the muzzle is 1.65 ahead. */
const MAIN_GUN: HardpointDef = {
  id: 'main',
  on: 'turret',
  at: { forward: 0.6, right: 0 },
  size: 'large',
  trigger: 'primary',
  height: 0.16,
};

/** The coaxial hardpoint, left of the main gun and lower (as in the prototype). */
const COAX: HardpointDef = {
  id: 'coax',
  on: 'turret',
  at: { forward: 0.43, right: -0.2 },
  size: 'small',
  trigger: 'secondary',
  height: 0.11,
};

export const PLAYER_TANK: VehicleDef = {
  name: 'Player tank',
  mass: 30,
  hull: { length: 2.4, width: 1.6 },
  health: 100,
  armor: TANK_ARMOR,
  locomotion: {
    kind: 'tracked',
    topSpeed: 7,
    reverseFactor: 0.6,
    accelTime: 0.4,
    stopTime: 0.25,
    shiftTime: 0.15,
    turnRate: 2.3,
    turnAccelTime: 0.1,
    grip: 40,
  },
  turret: {
    traverseRate: 4.0,
    spinUpTime: 0.05,
    snapAngle: degToRad(1),
    minAimDistance: 1.2,
    pivotForward: TURRET_PIVOT_FORWARD,
  },
  hardpoints: [MAIN_GUN, COAX],
  loadout: { main: CANNON, coax: MACHINE_GUN },
};

export const INSURGENT_TANK: VehicleDef = {
  name: 'Insurgent tank',
  mass: 20,
  hull: { length: 2.4, width: 1.6 },
  health: 60,
  armor: TANK_ARMOR,
  locomotion: {
    kind: 'tracked',
    topSpeed: 4,
    reverseFactor: 0.6,
    accelTime: 0.5,
    stopTime: 0.15,
    shiftTime: 0.2,
    turnRate: 1.4,
    turnAccelTime: 0.1,
    // High enough that a full-speed ram shoves it ~1 u sideways, not ~6 u (M2-3b).
    grip: 50,
  },
  turret: {
    traverseRate: 1.8,
    spinUpTime: 0.05,
    snapAngle: degToRad(1),
    minAimDistance: 1.2,
    pivotForward: TURRET_PIVOT_FORWARD,
  },
  hardpoints: [MAIN_GUN],
  loadout: { main: INSURGENT_CANNON },
};
