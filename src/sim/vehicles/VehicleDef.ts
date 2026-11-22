import type { ArmorDef } from '../combat/ArmorDef';
import type { WeaponDef } from '../combat/WeaponDef';

/**
 * Design cap on any vehicle's top speed (u/s), including future chassis and
 * upgrades (`resolveBuild` must clamp to it). Physics sizes its contact
 * prediction from it, so nothing can move fast enough to sink into an
 * obstacle or another tank between ticks (T-66). Raise it deliberately.
 */
export const MAX_VEHICLE_SPEED = 12;

/**
 * A vehicle variant as plain data (CLAUDE.md rule 8). The player tank and the
 * insurgent tank are two of these, not two classes; `createVehicle` turns one
 * into a `Vehicle`. Values live in `src/sim/defs/vehicles.ts`.
 */
export interface VehicleDef {
  readonly name: string;
  /** Relative units. Heavier vehicles shove harder and are harder to shove (M2-3). */
  readonly mass: number;
  readonly hull: HullDef;
  /** Hit points when undamaged (the GDD's "armor" bar). */
  readonly health: number;
  /** Damage multipliers by face (GDD §5). */
  readonly armor: ArmorDef;
  readonly locomotion: LocomotionDef;
  readonly turret: TurretDef;
  /** Where weapons can attach, in the order they are updated and fire (M3 plan D14). */
  readonly hardpoints: readonly HardpointDef[];
  /** Which weapon is fitted to which hardpoint (by id). Hardpoints may be left empty. */
  readonly loadout: Readonly<Record<string, WeaponDef>>;
}

/** Which trigger fires a weapon: primary (cannon) or secondary (machine gun), GDD §3. */
export type WeaponSlot = 'primary' | 'secondary';

/** Weapons only fit hardpoints of their size (validated when a vehicle is built). */
export type HardpointSize = 'small' | 'large';

/**
 * A place on the chassis where a weapon can be fitted (D14). The weapon
 * brings its own barrel; its muzzle is this position plus the barrel's
 * length, so swapping weapons never means re-entering muzzle numbers.
 */
export interface HardpointDef {
  readonly id: string;
  /** Turret hardpoints turn with the aim; hull hardpoints face along the hull. */
  readonly on: 'turret' | 'hull';
  /** Where the barrel starts (u), relative to the turret pivot or the hull centre. */
  readonly at: {
    /** Along the turret's (or hull's) facing. */
    readonly forward: number;
    /** To its right; negative is left. */
    readonly right: number;
  };
  readonly size: HardpointSize;
  readonly trigger: WeaponSlot;
  /** Barrel height above the frame's origin (turret pivot or hull centre), u. Cosmetic: the sim is planar. */
  readonly height: number;
}

/** How the turret follows the aim point (GDD §3, M3 plan D1). */
export interface TurretDef {
  /** rad/s, in world terms: the turret is stabilised, so hull turning doesn't add to it. */
  readonly traverseRate: number;
  /** Seconds the turret waits before it starts to traverse toward a new aim (whole ticks). */
  readonly spinUpTime: number;
  /** Within this angle (rad) of the aim, the turret snaps onto it and stops. */
  readonly snapAngle: number;
  /** Aim points closer than this to the tank (u) are ignored, so it doesn't spin under the cursor. */
  readonly minAimDistance: number;
  /** Where the turret pivots, along the hull from its centre (u, negative = behind). */
  readonly pivotForward: number;
}

/** The hull footprint, which is also its collision box (GDD §3). */
export interface HullDef {
  /** Units, along the heading. */
  readonly length: number;
  /** Units, across the heading. */
  readonly width: number;
}

/** One entry per `Locomotion` implementation; `kind` picks the class. Legged or hover come later. */
export type LocomotionDef = TrackedLocomotionDef;

export interface TrackedLocomotionDef {
  readonly kind: 'tracked';
  /** Forward top speed, u/s. */
  readonly topSpeed: number;
  /** Reverse top speed as a fraction of `topSpeed`. */
  readonly reverseFactor: number;
  /** Seconds from rest to top speed at full throttle. Sets engine force: mass × topSpeed / accelTime. */
  readonly accelTime: number;
  /** Seconds from top speed to rest with no throttle. */
  readonly stopTime: number;
  /** Seconds the tank sits stopped when changing between forward and reverse (gear change). 0 = none. */
  readonly shiftTime: number;
  /** Hull turn rate at full turn input, rad/s. */
  readonly turnRate: number;
  /** Seconds from no turn to full turn rate. */
  readonly turnAccelTime: number;
  /** Most sideways velocity the tracks can cancel per second, u/s². Must exceed topSpeed × turnRate to hold a full-speed turn. */
  readonly grip: number;
}
