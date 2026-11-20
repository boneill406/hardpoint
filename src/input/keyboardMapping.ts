import type { Vec2 } from '../sim/core/Vec2';
import type { KeyboardBindings } from './bindings';
import type { PlayerIntent } from './PlayerIntent';

/** The raw keyboard and mouse state for one frame. */
export interface KeyboardMouseState {
  /** `KeyboardEvent.code` of every key held down. */
  readonly keys: ReadonlySet<string>;
  /** `MouseEvent.button` of every mouse button held down. */
  readonly mouseButtons: ReadonlySet<number>;
  /** Ground point under the cursor, or undefined if the cursor isn't over the ground. */
  readonly aimPoint: Vec2 | undefined;
}

/**
 * Keyboard + mouse → intent. Pure, so the mapping is unit-tested (M2 plan D7).
 * Opposite keys cancel (W+S = no throttle), like holding both on a real stick.
 */
export function keyboardIntent(
  state: KeyboardMouseState,
  bindings: KeyboardBindings,
): PlayerIntent {
  const held = (codes: readonly string[]): boolean => codes.some((code) => state.keys.has(code));
  const clicked = (buttons: readonly number[]): boolean =>
    buttons.some((button) => state.mouseButtons.has(button));
  const axis = (positive: boolean, negative: boolean): number =>
    (positive ? 1 : 0) - (negative ? 1 : 0);

  return {
    drive: {
      kind: 'tank',
      throttle: axis(held(bindings.forward), held(bindings.back)),
      turn: axis(held(bindings.right), held(bindings.left)),
    },
    aim: state.aimPoint === undefined ? { kind: 'none' } : { kind: 'point', point: state.aimPoint },
    firePrimary: held(bindings.firePrimary) || clicked(bindings.mousePrimary),
    fireSecondary: held(bindings.fireSecondary) || clicked(bindings.mouseSecondary),
  };
}
