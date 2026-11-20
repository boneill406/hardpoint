import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputDevice } from '../../src/input/InputDevice';
import { InputManager } from '../../src/input/InputManager';
import { NO_INTENT, type PlayerIntent } from '../../src/input/PlayerIntent';

/** A device whose intent and last-activity time the test sets directly. */
class FakeDevice implements InputDevice {
  lastActivityMs = Number.NEGATIVE_INFINITY;
  intent: PlayerIntent = NO_INTENT;
  disposed = false;

  constructor(readonly name: string) {}

  read(): PlayerIntent {
    return this.intent;
  }

  dispose(): void {
    this.disposed = true;
  }
}

const FORWARD: PlayerIntent = { ...NO_INTENT, drive: { kind: 'tank', throttle: 1, turn: 0 } };
const REVERSE: PlayerIntent = { ...NO_INTENT, drive: { kind: 'tank', throttle: -1, turn: 0 } };

describe('InputManager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('gives no intent before any device has been used', () => {
    const keyboard = new FakeDevice('keyboard');
    keyboard.intent = FORWARD;
    expect(new InputManager([keyboard]).read(0)).toBe(NO_INTENT);
  });

  it('the most recently used device wins', () => {
    const keyboard = new FakeDevice('keyboard');
    const pad = new FakeDevice('pad');
    keyboard.intent = FORWARD;
    pad.intent = REVERSE;
    const input = new InputManager([keyboard, pad]);

    keyboard.lastActivityMs = 100;
    pad.lastActivityMs = 50;
    expect(input.read(200)).toBe(FORWARD);

    pad.lastActivityMs = 150;
    expect(input.read(200)).toBe(REVERSE);
  });

  it('dispose disposes every device', () => {
    const keyboard = new FakeDevice('keyboard');
    const pad = new FakeDevice('pad');
    new InputManager([keyboard, pad]).dispose();
    expect(keyboard.disposed && pad.disposed).toBe(true);
  });
});
