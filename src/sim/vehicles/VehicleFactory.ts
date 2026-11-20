import type { Transform } from '../core/Transform';
import type { Controller } from './controllers/Controller';
import type { Faction } from './Faction';
import type { Locomotion } from './locomotion/Locomotion';
import { TrackedLocomotion } from './locomotion/TrackedLocomotion';
import { Vehicle } from './Vehicle';
import type { LocomotionDef, VehicleDef } from './VehicleDef';

/** Where and for whom a vehicle is created; everything else comes from its def. */
export interface VehicleSpawn {
  readonly transform: Transform;
  readonly faction: Faction;
  readonly controller: Controller;
}

/**
 * Assembles a `Vehicle` from a def (architecture.md §4, "content is data"): the
 * def's `locomotion.kind` picks the `Locomotion` implementation. Adding a new
 * tank variant is a new def, not new code.
 */
export function createVehicle(def: VehicleDef, spawn: VehicleSpawn): Vehicle {
  return new Vehicle(
    spawn.transform,
    def,
    spawn.faction,
    spawn.controller,
    createLocomotion(def.locomotion),
  );
}

function createLocomotion(def: LocomotionDef): Locomotion {
  switch (def.kind) {
    case 'tracked':
      return new TrackedLocomotion(def);
  }
}
