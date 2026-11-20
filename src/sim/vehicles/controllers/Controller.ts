import type { Vehicle } from '../Vehicle';
import type { PlayerId, VehicleCommand } from '../VehicleCommand';

/** What a controller may look at when deciding. Read-only by convention (CLAUDE.md rule 3). */
export interface ControllerContext {
  readonly tick: number;
  /** This tick's human input, by player. */
  readonly commands: ReadonlyMap<PlayerId, VehicleCommand>;
  /** The vehicle being driven. */
  readonly vehicle: Vehicle;
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
