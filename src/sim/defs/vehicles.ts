import { degToRad } from '../core/angles';
import type { VehicleDef } from '../vehicles/VehicleDef';
import { CANNON, INSURGENT_CANNON, MACHINE_GUN } from './weapons';

// Vehicle tuning (GDD §3, §5; M2 plan D3, D4). Starting values: edit and save,
// and Vite reloads the game with the new numbers.

/** Turret pivot and muzzles, matching the primitive model (M2-6): the barrel tip is the cannon's muzzle. */
const TURRET_PIVOT_FORWARD = -0.05;
const CANNON_MUZZLE = { forward: 1.65, right: 0 };
/** Half the cannon's muzzle-brake width, plus a little: the barrel stops short of walls. */
const CANNON_CLEARANCE = 0.12;
/** The coaxial machine gun sits left of the cannon (as in the prototype). */
const COAX_MUZZLE = { forward: 0.9, right: -0.2 };
const COAX_CLEARANCE = 0.06;

export const PLAYER_TANK: VehicleDef = {
  name: 'Player tank',
  mass: 30,
  hull: { length: 2.4, width: 1.6 },
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
  weapons: [
    { slot: 'primary', weapon: CANNON, muzzle: CANNON_MUZZLE, clearanceRadius: CANNON_CLEARANCE },
    {
      slot: 'secondary',
      weapon: MACHINE_GUN,
      muzzle: COAX_MUZZLE,
      clearanceRadius: COAX_CLEARANCE,
    },
  ],
};

export const INSURGENT_TANK: VehicleDef = {
  name: 'Insurgent tank',
  mass: 20,
  hull: { length: 2.4, width: 1.6 },
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
  weapons: [
    {
      slot: 'primary',
      weapon: INSURGENT_CANNON,
      muzzle: CANNON_MUZZLE,
      clearanceRadius: CANNON_CLEARANCE,
    },
  ],
};
