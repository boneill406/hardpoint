import { describe, expect, it } from 'vitest';
import { KEYBOARD_BINDINGS } from '../../src/input/bindings';
import { keyboardIntent } from '../../src/input/keyboardMapping';
import type { PlayerIntent } from '../../src/input/PlayerIntent';
import { Vec2 } from '../../src/sim/core/Vec2';

function intent(keys: string[], mouseButtons: number[] = [], aimPoint?: Vec2): PlayerIntent {
  return keyboardIntent(
    { keys: new Set(keys), mouseButtons: new Set(mouseButtons), aimPoint },
    KEYBOARD_BINDINGS,
  );
}

describe('keyboardIntent', () => {
  it('W drives forward and S reverses', () => {
    expect(intent(['KeyW']).drive).toEqual({ kind: 'tank', throttle: 1, turn: 0 });
    expect(intent(['KeyS']).drive).toEqual({ kind: 'tank', throttle: -1, turn: 0 });
  });

  it('D turns clockwise (+1) and A counter-clockwise (−1)', () => {
    expect(intent(['KeyD']).drive).toEqual({ kind: 'tank', throttle: 0, turn: 1 });
    expect(intent(['KeyA']).drive).toEqual({ kind: 'tank', throttle: 0, turn: -1 });
  });

  it('opposite keys cancel', () => {
    expect(intent(['KeyW', 'KeyS', 'KeyA', 'KeyD']).drive).toEqual({
      kind: 'tank',
      throttle: 0,
      turn: 0,
    });
  });

  it('arrow keys drive like WASD', () => {
    expect(intent(['ArrowUp', 'ArrowRight']).drive).toEqual({ kind: 'tank', throttle: 1, turn: 1 });
  });

  it('left mouse or Space fires primary; right mouse or F fires secondary', () => {
    expect(intent([], [0]).firePrimary).toBe(true);
    expect(intent(['Space']).firePrimary).toBe(true);
    expect(intent([], [2]).fireSecondary).toBe(true);
    expect(intent(['KeyF']).fireSecondary).toBe(true);
    expect(intent(['KeyW']).firePrimary).toBe(false);
  });

  it('aims at the ground point under the cursor, or nowhere when there is none', () => {
    const point = new Vec2(3, 4);
    expect(intent([], [], point).aim).toEqual({ kind: 'point', point });
    expect(intent([]).aim).toEqual({ kind: 'none' });
  });
});
