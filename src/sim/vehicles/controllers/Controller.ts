import type { SimQueries } from '../../core/SimQueries';
import type { VehicleView } from '../VehicleView';
import type { PlayerId, VehicleCommand } from '../VehicleCommand';

/** What a controller may look at when deciding. Read-only by type (CLAUDE.md rule 3, M4 plan D1). */
export interface ControllerContext {
  readonly tick: number;
  /** This tick's human input, by player. */
  readonly commands: ReadonlyMap<PlayerId, VehicleCommand>;
  /** The vehicle being driven, read-only. */
  readonly vehicle: VehicleView;
  /** What the controller may ask about the rest of the world (M4 plan D1). */
  readonly world: SimQueries;
}

/**
 * Who drives a vehicle (architecture.md §4): the player, the AI, later a remote
 * co-op player. `Vehicle` never knows which, so player and enemy tanks share
 * every other piece of code.
 */
export interface Controller {
  /** Called once per tick, before locomotion. */
  decide(context: ControllerContext): VehicleCommand;
}
