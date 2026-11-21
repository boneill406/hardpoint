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
  validateLoadout(def);
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

/**
 * A loadout must fit its chassis (M3 plan D14): every fitted weapon goes on a
 * hardpoint that exists, and of the same size class. Throws on a bad def, like
 * other caller bugs (T-35); later, custom builds are checked the same way.
 */
function validateLoadout(def: VehicleDef): void {
  const hardpoints = new Map(def.hardpoints.map((hardpoint) => [hardpoint.id, hardpoint]));
  if (hardpoints.size !== def.hardpoints.length) {
    throw new RangeError(`${def.name}: hardpoint ids must be unique`);
  }
  for (const [id, weapon] of Object.entries(def.loadout)) {
    const hardpoint = hardpoints.get(id);
    if (hardpoint === undefined) {
      throw new RangeError(`${def.name}: loadout names unknown hardpoint "${id}"`);
    }
    if (hardpoint.size !== weapon.size) {
      throw new RangeError(
        `${def.name}: ${weapon.name} (${weapon.size}) doesn't fit hardpoint "${id}" (${hardpoint.size})`,
      );
    }
  }
}
