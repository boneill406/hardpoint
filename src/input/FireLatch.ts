import type { VehicleCommand } from '../sim/vehicles/VehicleCommand';

/**
 * Makes sure a short fire press reaches the simulation (T-56). Input is read
 * once per frame, but on fast screens many frames run no tick at all; a press
 * read on such a frame would otherwise be gone before any tick saw it. The
 * latch keeps a press pending until a tick has consumed it.
 */
export class FireLatch {
  private primary = false;
  private secondary = false;

  /** This frame's command, with any fire press still waiting for a tick added in. */
  apply(command: VehicleCommand): VehicleCommand {
    this.primary ||= command.firePrimary;
    this.secondary ||= command.fireSecondary;
    return { ...command, firePrimary: this.primary, fireSecondary: this.secondary };
  }

  /** Ticks ran with the last applied command, so pending presses have been seen. */
  consumed(): void {
    this.primary = false;
    this.secondary = false;
  }
}
