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
  readonly locomotion: LocomotionDef;
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
  /** Hull turn rate at full turn input, rad/s. */
  readonly turnRate: number;
  /** Seconds from no turn to full turn rate. */
  readonly turnAccelTime: number;
  /** Most sideways velocity the tracks can cancel per second, u/s². Must exceed topSpeed × turnRate to hold a full-speed turn. */
  readonly grip: number;
}
