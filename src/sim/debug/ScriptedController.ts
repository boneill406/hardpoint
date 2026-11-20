import type { Controller, ControllerContext } from '../vehicles/controllers/Controller';
import type { VehicleCommand } from '../vehicles/VehicleCommand';

/**
 * Drives a vehicle from a fixed script of tick → command. Used by tests, and by
 * the debug scene in `main.ts` until player input exists (M2-2).
 */
export class ScriptedController implements Controller {
  constructor(private readonly script: (tick: number) => VehicleCommand) {}

  decide(context: ControllerContext): VehicleCommand {
    return this.script(context.tick);
  }
}
