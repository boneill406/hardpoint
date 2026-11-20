import type { PadScheme } from './bindings';
import { gamepadIntent } from './gamepadMapping';
import type { InputDevice } from './InputDevice';
import { hasInput, NO_INTENT, type PlayerIntent } from './PlayerIntent';

/**
 * Xbox (or any "standard" mapping) gamepad, polled each frame (architecture.md
 * §7). Browsers only expose a pad after a button press, so it appears the first
 * time you press something. Uses the first connected pad.
 */
export class GamepadDevice implements InputDevice {
  readonly name = 'gamepad';
  private activityMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly scheme: PadScheme) {}

  get lastActivityMs(): number {
    return this.activityMs;
  }

  read(nowMs: number): PlayerIntent {
    const pad = navigator.getGamepads().find((candidate) => candidate?.connected === true);
    if (pad === undefined || pad === null) {
      return NO_INTENT;
    }
    const intent = gamepadIntent(
      { axes: pad.axes, buttons: pad.buttons.map((button) => button.value) },
      this.scheme,
    );
    if (hasInput(intent)) {
      this.activityMs = nowMs;
    }
    return intent;
  }

  dispose(): void {
    // Polled, no listeners to remove.
  }
}
