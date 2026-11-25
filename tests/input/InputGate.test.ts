import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../src/sim/core/Vec2';
import { InputGate } from '../../src/input/InputGate';
import { NO_INTENT, type PlayerIntent } from '../../src/input/PlayerIntent';

const aim = { kind: 'point', point: new Vec2(3, 4) } as const;
const firing: PlayerIntent = { ...NO_INTENT, aim, firePrimary: true };
const driving: PlayerIntent = { ...NO_INTENT, aim, drive: { kind: 'tank', throttle: 1, turn: 0 } };
const idle: PlayerIntent = { ...NO_INTENT, aim };

describe('InputGate', () => {
  it('passes everything until blocked', () => {
    expect(new InputGate().filter(firing)).toEqual(firing);
  });

  it('after a block, a still-held key neither fires nor drives, but aim passes', () => {
    const gate = new InputGate();
    gate.block();
    expect(gate.filter(firing)).toEqual(idle);
    expect(gate.filter(driving)).toEqual(idle);
  });

  it('opens on the first frame with nothing held, then passes presses', () => {
    const gate = new InputGate();
    gate.block();
    gate.filter(firing);
    expect(gate.filter(idle)).toEqual(idle);
    expect(gate.filter(firing)).toEqual(firing);
  });
});
