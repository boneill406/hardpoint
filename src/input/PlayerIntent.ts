import type { Vec2 } from '../sim/core/Vec2';

/**
 * How the player wants to drive. Most schemes give throttle and turn directly;
 * the `direct` gamepad scheme gives a world direction to head in, which
 * `intentToCommand` turns into throttle and turn using the tank's heading.
 */
export type DriveIntent =
  | { readonly kind: 'tank'; readonly throttle: number; readonly turn: number }
  /** `direction` is a world-space vector; its length (0..1) is how hard to drive. */
  | { readonly kind: 'direct'; readonly direction: Vec2 };

/** Where the player wants the turret to point. `none` keeps the previous aim. */
export type AimIntent =
  | { readonly kind: 'point'; readonly point: Vec2 }
  /** A world-space direction from the tank (gamepad right stick). */
  | { readonly kind: 'direction'; readonly direction: Vec2 }
  | { readonly kind: 'none' };

/**
 * What one input device says the player wants this frame (architecture.md §7).
 * Keyboard/mouse and gamepad both produce this, so nothing downstream knows
 * which device is in use. Lives outside the sim: `intentToCommand` turns it into
 * the sim's `VehicleCommand`.
 */
export interface PlayerIntent {
  readonly drive: DriveIntent;
  readonly aim: AimIntent;
  readonly firePrimary: boolean;
  readonly fireSecondary: boolean;
}

export const NO_INTENT: PlayerIntent = {
  drive: { kind: 'tank', throttle: 0, turn: 0 },
  aim: { kind: 'none' },
  firePrimary: false,
  fireSecondary: false,
};

/** True if the intent asks for anything; used to decide which device the player is using. */
export function hasInput(intent: PlayerIntent): boolean {
  const { drive } = intent;
  const driving =
    drive.kind === 'tank'
      ? drive.throttle !== 0 || drive.turn !== 0
      : drive.direction.length() !== 0;
  return driving || intent.aim.kind !== 'none' || intent.firePrimary || intent.fireSecondary;
}
