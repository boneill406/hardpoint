import { MENU_KEYS, MENU_STICK_THRESHOLD, PAD } from './bindings';

/**
 * What menu input means (M5-4). `back` is Esc or B; `pause` is the pad's
 * Start; `any` is any press at all ("press any key / A" on the title).
 */
export type MenuAction = 'up' | 'down' | 'confirm' | 'back' | 'pause' | 'any';

/** The parts of a pad the menus read, at one moment. */
export interface PadMenuSnapshot {
  readonly pressed: readonly boolean[];
  /** Left stick Y: −1 up, +1 down. */
  readonly stickY: number;
}

/** Actions for one key press (`KeyboardEvent.code`). */
export function keyMenuActions(code: string): MenuAction[] {
  const actions: MenuAction[] = ['any'];
  if (MENU_KEYS.up.includes(code)) actions.push('up');
  if (MENU_KEYS.down.includes(code)) actions.push('down');
  if (MENU_KEYS.confirm.includes(code)) actions.push('confirm');
  if (MENU_KEYS.back.includes(code)) actions.push('back');
  return actions;
}

/**
 * Actions from a pad between two polls: only buttons that went down since
 * `prev` count, and the stick only when it crosses the threshold, so holding
 * a button or the stick doesn't repeat.
 */
export function padMenuActions(
  prev: PadMenuSnapshot | undefined,
  curr: PadMenuSnapshot,
): MenuAction[] {
  const pressedNow = (index: number): boolean =>
    curr.pressed[index] === true && prev?.pressed[index] !== true;
  const actions: MenuAction[] = [];
  if (curr.pressed.some((_, index) => pressedNow(index))) actions.push('any');
  const stickUp = (y: number | undefined): boolean => (y ?? 0) < -MENU_STICK_THRESHOLD;
  const stickDown = (y: number | undefined): boolean => (y ?? 0) > MENU_STICK_THRESHOLD;
  if (pressedNow(PAD.buttons.dpadUp) || (stickUp(curr.stickY) && !stickUp(prev?.stickY))) {
    actions.push('up');
  }
  if (pressedNow(PAD.buttons.dpadDown) || (stickDown(curr.stickY) && !stickDown(prev?.stickY))) {
    actions.push('down');
  }
  if (pressedNow(PAD.buttons.a)) actions.push('confirm');
  if (pressedNow(PAD.buttons.b)) actions.push('back');
  if (pressedNow(PAD.buttons.start)) actions.push('pause');
  return actions;
}
