import type { Vec2 } from '../sim/core/Vec2';
import { KEYBOARD_BINDINGS, type KeyboardBindings } from './bindings';
import type { InputDevice } from './InputDevice';
import { keyboardIntent } from './keyboardMapping';
import type { PlayerIntent } from './PlayerIntent';

/** Canvas pixel coordinates → ground point under them (wired to `Renderer.screenToGround`). */
export type ScreenToGround = (x: number, y: number) => Vec2 | undefined;

/**
 * Keyboard + mouse (architecture.md §7). Tracks which keys and buttons are held
 * from DOM events; the mapping to an intent is the pure `keyboardIntent`.
 */
export class KeyboardMouseDevice implements InputDevice {
  readonly name = 'keyboard + mouse';
  private activityMs = Number.NEGATIVE_INFINITY;
  private readonly keys = new Set<string>();
  private readonly mouseButtons = new Set<number>();
  /** Pressed since the last read, even if already released: a tap between two frames still counts. */
  private readonly tappedKeys = new Set<string>();
  private readonly tappedButtons = new Set<number>();
  private cursor: { readonly x: number; readonly y: number } | undefined;
  private readonly listeners = new AbortController();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly screenToGround: ScreenToGround,
    private readonly bindings: KeyboardBindings = KEYBOARD_BINDINGS,
  ) {
    const { signal } = this.listeners;
    window.addEventListener('keydown', (event) => this.onKey(event, true), { signal });
    window.addEventListener('keyup', (event) => this.onKey(event, false), { signal });
    // Keys released while the window is unfocused never send keyup; forget them so the tank doesn't run away.
    window.addEventListener('blur', () => this.releaseAll(), { signal });
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event), { signal });
    canvas.addEventListener('pointerdown', (event) => this.onPointerButton(event, true), {
      signal,
    });
    window.addEventListener('pointerup', (event) => this.onPointerButton(event, false), { signal });
    // Right mouse fires the machine gun, so the browser's context menu must not open.
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  }

  get lastActivityMs(): number {
    return this.activityMs;
  }

  read(): PlayerIntent {
    const aimPoint =
      this.cursor === undefined ? undefined : this.screenToGround(this.cursor.x, this.cursor.y);
    const intent = keyboardIntent(
      {
        keys: new Set([...this.keys, ...this.tappedKeys]),
        mouseButtons: new Set([...this.mouseButtons, ...this.tappedButtons]),
        aimPoint,
      },
      this.bindings,
    );
    this.tappedKeys.clear();
    this.tappedButtons.clear();
    return intent;
  }

  dispose(): void {
    this.listeners.abort();
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    if (!this.isBound(event.code)) {
      return;
    }
    // Stop Space and the arrow keys from scrolling the page.
    event.preventDefault();
    if (down) {
      this.keys.add(event.code);
      this.tappedKeys.add(event.code);
    } else {
      this.keys.delete(event.code);
    }
    this.activityMs = event.timeStamp;
  }

  private onPointerMove(event: PointerEvent): void {
    this.cursor = { x: event.offsetX, y: event.offsetY };
    this.activityMs = event.timeStamp;
  }

  private onPointerButton(event: PointerEvent, down: boolean): void {
    if (down) {
      this.mouseButtons.add(event.button);
      this.tappedButtons.add(event.button);
    } else {
      this.mouseButtons.delete(event.button);
    }
    this.activityMs = event.timeStamp;
  }

  private releaseAll(): void {
    this.keys.clear();
    this.mouseButtons.clear();
  }

  private isBound(code: string): boolean {
    const { forward, back, left, right, firePrimary, fireSecondary } = this.bindings;
    return [forward, back, left, right, firePrimary, fireSecondary].some((codes) =>
      codes.includes(code),
    );
  }
}
