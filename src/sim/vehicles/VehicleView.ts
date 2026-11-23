import type { EntityId } from '../core/Entity';
import type { Transform } from '../core/Transform';
import type { Vec2 } from '../core/Vec2';
import type { Faction } from './Faction';
import type { VehicleDef } from './VehicleDef';

/**
 * A vehicle as controllers see it (M4 plan D1): readable, with nothing that
 * changes state. `Vehicle` satisfies it, so this costs no copying; the type
 * system stops a controller calling `applyCommand`, `drive` or `health.damage`
 * on another tank, or on its own (CLAUDE.md rule 3).
 */
export interface VehicleView {
  readonly id: EntityId;
  readonly def: VehicleDef;
  readonly faction: Faction;
  readonly transform: Transform;
  readonly linearVelocity: Vec2;
  readonly angularVelocity: number;
  readonly health: { readonly current: number; readonly max: number; readonly depleted: boolean };
  readonly turret: { readonly heading: number };
  /** Where the turret pivots now: where sight and aim are measured from. */
  turretPivot(): Vec2;
}
