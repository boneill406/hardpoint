// Control bindings as data (M2 plan D6). Changing a binding means editing a
// line here; nothing else in the game refers to specific keys or buttons.

/** Keyboard actions → `KeyboardEvent.code` values (physical keys, so layout-independent). */
export interface KeyboardBindings {
  readonly forward: readonly string[];
  readonly back: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly firePrimary: readonly string[];
  readonly fireSecondary: readonly string[];
  /** `MouseEvent.button` values: 0 = left, 2 = right. */
  readonly mousePrimary: readonly number[];
  readonly mouseSecondary: readonly number[];
}

export const KEYBOARD_BINDINGS: KeyboardBindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  firePrimary: ['Space'],
  fireSecondary: ['KeyF'],
  mousePrimary: [0],
  mouseSecondary: [2],
};

/**
 * Indices in the browser's "standard" gamepad mapping (an Xbox pad reports it).
 * https://w3c.github.io/gamepad/#remapping
 */
export const PAD = {
  axes: { leftX: 0, leftY: 1, rightX: 2, rightY: 3 },
  buttons: { a: 0, b: 1, lb: 4, rb: 5, lt: 6, rt: 7, start: 9, dpadUp: 12, dpadDown: 13 },
} as const;

export type PadSchemeName = 'tank' | 'direct' | 'triggers';

/**
 * A gamepad control scheme, chosen with `?pad=` so schemes can be compared in
 * play. `drive` picks how the sticks/triggers drive; fire buttons are indices
 * into `Gamepad.buttons`. The right stick always aims.
 */
export interface PadScheme {
  /**
   * `tank`: left stick Y = throttle, X = turn (GDD §3).
   * `direct`: left stick points where to go; the tank turns toward it and drives.
   * `triggers`: RT = forward, LT = reverse (analog), left stick X = turn.
   */
  readonly drive: PadSchemeName;
  readonly firePrimary: number;
  readonly fireSecondary: number;
}

export const PAD_SCHEMES: Readonly<Record<PadSchemeName, PadScheme>> = {
  tank: { drive: 'tank', firePrimary: PAD.buttons.rt, fireSecondary: PAD.buttons.lt },
  direct: { drive: 'direct', firePrimary: PAD.buttons.rt, fireSecondary: PAD.buttons.lt },
  triggers: { drive: 'triggers', firePrimary: PAD.buttons.rb, fireSecondary: PAD.buttons.lb },
};

/** Stick input inside this radius counts as zero (worn sticks rest slightly off-centre). */
export const STICK_DEADZONE = 0.15;
/** A trigger counts as pressed (for firing) beyond this value. */
export const TRIGGER_THRESHOLD = 0.5;

/**
 * Menu keys (M5-4): `KeyboardEvent.code` values. `back` also pauses and resumes
 * during play. P is there because browsers reserve Esc to leave fullscreen
 * (Safari can't be stopped), so Esc pauses *and* exits fullscreen (M5-4b).
 */
export interface MenuKeyBindings {
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly confirm: readonly string[];
  readonly back: readonly string[];
}

export const MENU_KEYS: MenuKeyBindings = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'KeyP'],
};

/** The left stick moves the menu highlight once it passes this (then must return first). */
export const MENU_STICK_THRESHOLD = 0.5;
