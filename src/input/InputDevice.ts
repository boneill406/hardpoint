import type { PlayerIntent } from './PlayerIntent';

/** One physical input device, polled once per frame by `InputManager`. */
export interface InputDevice {
  /** For logs when the active device changes. */
  readonly name: string;
  /** When the player last used this device (same clock as `requestAnimationFrame` timestamps). */
  readonly lastActivityMs: number;
  /** This frame's intent. `nowMs` is the frame's timestamp. */
  read(nowMs: number): PlayerIntent;
  /** Removes event listeners. */
  dispose(): void;
}
