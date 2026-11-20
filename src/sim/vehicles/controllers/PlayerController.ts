import { IDLE_COMMAND, type PlayerId, type VehicleCommand } from '../VehicleCommand';
import type { Controller, ControllerContext } from './Controller';

/**
 * Drives a vehicle from one human player's command. The command arrives through
 * `Simulation.tick(commands)`, so local input, a replay, or (later) a co-op
 * peer's network input all look the same here (ADR-0001).
 */
export class PlayerController implements Controller {
  constructor(readonly playerId: PlayerId) {}

  /** No command this tick (input not ready, a dropped packet later) means idle, not "repeat the last one". */
  decide(context: ControllerContext): VehicleCommand {
    return context.commands.get(this.playerId) ?? IDLE_COMMAND;
  }
}
