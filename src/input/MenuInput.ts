import { PAD } from './bindings';
import {
  keyMenuActions,
  padMenuActions,
  type MenuAction,
  type PadMenuSnapshot,
} from './menuMapping';

/**
 * Menu and pause input (M5-4), separate from driving input: key presses and
 * clicks are queued as they happen, the pad is polled for new presses. `read()`
 * returns everything since the last call. The meaning of each action depends
 * on the screen, which the app decides.
 */
export class MenuInput {
  private queue: MenuAction[] = [];
  private lastPad: PadMenuSnapshot | undefined;
  private readonly abort = new AbortController();

  constructor() {
    const { signal } = this.abort;
    window.addEventListener(
      'keydown',
      (event) => {
        if (!event.repeat) {
          this.queue.push(...keyMenuActions(event.code));
        }
      },
      { signal },
    );
    window.addEventListener('pointerdown', () => this.queue.push('any'), { signal });
  }

  read(): MenuAction[] {
    const actions = [...this.queue, ...this.pollPad()];
    this.queue = [];
    return actions;
  }

  dispose(): void {
    this.abort.abort();
  }

  private pollPad(): MenuAction[] {
    const pad = navigator.getGamepads().find((candidate) => candidate?.connected === true);
    if (pad === undefined || pad === null) {
      this.lastPad = undefined;
      return [];
    }
    const snapshot: PadMenuSnapshot = {
      pressed: pad.buttons.map((button) => button.pressed),
      stickY: pad.axes[PAD.axes.leftY] ?? 0,
    };
    const actions = padMenuActions(this.lastPad, snapshot);
    this.lastPad = snapshot;
    return actions;
  }
}
