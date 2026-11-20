import type { InputDevice } from './InputDevice';
import { NO_INTENT, type PlayerIntent } from './PlayerIntent';

/**
 * Combines devices into one intent per frame: the device used most recently
 * wins (M2 plan D6). Picking up the pad hands control to it on the first stick
 * movement; touching a key or the mouse hands it back.
 */
export class InputManager {
  private activeName: string | undefined;

  constructor(private readonly devices: readonly InputDevice[]) {}

  /** Polls every device (gamepads only report activity when polled) and returns the active one's intent. */
  read(nowMs: number): PlayerIntent {
    let active: { device: InputDevice; intent: PlayerIntent } | undefined;
    for (const device of this.devices) {
      const intent = device.read(nowMs);
      if (active === undefined || device.lastActivityMs > active.device.lastActivityMs) {
        active = { device, intent };
      }
    }
    if (active === undefined || active.device.lastActivityMs === Number.NEGATIVE_INFINITY) {
      return NO_INTENT;
    }
    this.logDeviceChange(active.device.name);
    return active.intent;
  }

  dispose(): void {
    for (const device of this.devices) {
      device.dispose();
    }
  }

  private logDeviceChange(name: string): void {
    if (name !== this.activeName) {
      this.activeName = name;
      console.info(`Input: ${name}`);
    }
  }
}
