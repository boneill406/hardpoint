import type { Vec2 } from '../core/Vec2';
import type { WeaponMountDef } from '../vehicles/VehicleDef';
import { Weapon } from './Weapon';

/** A shot a vehicle fired this tick: where it leaves the muzzle and which way it goes. */
export interface Shot {
  readonly mount: WeaponMount;
  /** Muzzle position on the ground plane. */
  readonly origin: Vec2;
  /** Travel heading, spread included. */
  readonly heading: number;
}

/**
 * A weapon fixed to a vehicle's turret (architecture.md §3): which trigger
 * fires it and where its muzzle sits relative to the turret pivot. The muzzle
 * offset is the single source of truth for where shells start (and, from
 * M3-7, for how long the barrel is drawn).
 */
export class WeaponMount {
  readonly weapon: Weapon;

  constructor(readonly def: WeaponMountDef) {
    this.weapon = new Weapon(def.weapon);
  }
}
