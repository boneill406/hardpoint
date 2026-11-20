import { degToRad } from '../core/angles';
import type { VehicleDef } from '../vehicles/VehicleDef';

// Vehicle tuning (GDD §3, §5; M2 plan D3, D4). Starting values: edit and save,
// and Vite reloads the game with the new numbers.

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
  turret: { traverseRate: 4.0, spinUpTime: 0.05, snapAngle: degToRad(1), minAimDistance: 1.2 },
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
  turret: { traverseRate: 1.8, spinUpTime: 0.05, snapAngle: degToRad(1), minAimDistance: 1.2 },
};
