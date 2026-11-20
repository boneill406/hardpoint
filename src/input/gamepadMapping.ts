import { Vec2 } from '../sim/core/Vec2';
import { PAD, STICK_DEADZONE, TRIGGER_THRESHOLD, type PadScheme } from './bindings';
import type { DriveIntent, PlayerIntent } from './PlayerIntent';

/** The raw gamepad state for one frame: `Gamepad.axes` and each `Gamepad.buttons[i].value`. */
export interface GamepadState {
  readonly axes: readonly number[];
  readonly buttons: readonly number[];
}

/**
 * Radial deadzone: input inside `deadzone` becomes zero, and the rest is
 * rescaled so pushing just past the deadzone starts near 0 rather than jumping
 * to 0.15. Radial (not per axis) so diagonals aren't distorted.
 */
export function radialDeadzone(x: number, y: number, deadzone: number): Vec2 {
  const length = Math.hypot(x, y);
  if (length <= deadzone) {
    return Vec2.ZERO;
  }
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return new Vec2((x / length) * scaled, (y / length) * scaled);
}

/**
 * Gamepad → intent for the given scheme. Pure, so it is unit-tested (M2 plan D7).
 *
 * Stick Y is negative when pushed up, and the camera looks along +z, so "up" on
 * a stick is +z in the world: world = (stickX, −stickY).
 */
export function gamepadIntent(state: GamepadState, scheme: PadScheme): PlayerIntent {
  const left = stick(state, PAD.axes.leftX, PAD.axes.leftY);
  const right = stick(state, PAD.axes.rightX, PAD.axes.rightY);

  return {
    drive: driveIntent(state, scheme, left),
    aim: right.length() === 0 ? { kind: 'none' } : { kind: 'direction', direction: right },
    firePrimary: pressed(state, scheme.firePrimary),
    fireSecondary: pressed(state, scheme.fireSecondary),
  };
}

function driveIntent(state: GamepadState, scheme: PadScheme, left: Vec2): DriveIntent {
  switch (scheme.drive) {
    case 'tank':
      return { kind: 'tank', throttle: left.z, turn: left.x };
    case 'direct':
      return { kind: 'direct', direction: left };
    case 'triggers': {
      const throttle = button(state, PAD.buttons.rt) - button(state, PAD.buttons.lt);
      return { kind: 'tank', throttle, turn: left.x };
    }
  }
}

/** One stick, deadzoned, as a world-space vector (up = +z). */
function stick(state: GamepadState, xAxis: number, yAxis: number): Vec2 {
  const raw = radialDeadzone(axis(state, xAxis), axis(state, yAxis), STICK_DEADZONE);
  return new Vec2(raw.x, -raw.z);
}

function axis(state: GamepadState, index: number): number {
  return state.axes[index] ?? 0;
}

function button(state: GamepadState, index: number): number {
  return state.buttons[index] ?? 0;
}

function pressed(state: GamepadState, index: number): boolean {
  return button(state, index) > TRIGGER_THRESHOLD;
}
