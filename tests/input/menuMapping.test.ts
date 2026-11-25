import { describe, expect, it } from 'vitest';
import { PAD } from '../../src/input/bindings';
import { keyMenuActions, padMenuActions } from '../../src/input/menuMapping';

function pad(pressed: number[], stickY = 0) {
  const buttons = Array.from({ length: 17 }, (_, i) => pressed.includes(i));
  return { pressed: buttons, stickY };
}

describe('keyMenuActions', () => {
  it('maps arrows/WS, Enter/Space and Esc; every key also counts as "any"', () => {
    expect(keyMenuActions('ArrowUp')).toEqual(['any', 'up']);
    expect(keyMenuActions('KeyS')).toEqual(['any', 'down']);
    expect(keyMenuActions('Enter')).toEqual(['any', 'confirm']);
    expect(keyMenuActions('Escape')).toEqual(['any', 'back']);
    expect(keyMenuActions('KeyQ')).toEqual(['any']);
  });
});

describe('padMenuActions', () => {
  it('A confirms, B goes back, Start pauses, D-pad moves', () => {
    expect(padMenuActions(pad([]), pad([PAD.buttons.a]))).toEqual(['any', 'confirm']);
    expect(padMenuActions(pad([]), pad([PAD.buttons.b]))).toEqual(['any', 'back']);
    expect(padMenuActions(pad([]), pad([PAD.buttons.start]))).toEqual(['any', 'pause']);
    expect(padMenuActions(pad([]), pad([PAD.buttons.dpadDown]))).toEqual(['any', 'down']);
  });

  it('a held button fires once, not every poll', () => {
    expect(padMenuActions(pad([PAD.buttons.a]), pad([PAD.buttons.a]))).toEqual([]);
  });

  it('the stick moves once per push past the threshold', () => {
    expect(padMenuActions(pad([], 0), pad([], -0.8))).toEqual(['up']);
    expect(padMenuActions(pad([], -0.8), pad([], -0.9))).toEqual([]);
    expect(padMenuActions(pad([], -0.9), pad([], 0.7))).toEqual(['down']);
    expect(padMenuActions(pad([], 0), pad([], 0.3))).toEqual([]);
  });

  it('the first poll after connecting counts held buttons as new', () => {
    expect(padMenuActions(undefined, pad([PAD.buttons.a]))).toEqual(['any', 'confirm']);
  });
});
