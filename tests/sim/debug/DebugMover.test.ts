import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { DebugMover } from '../../../src/sim/debug/DebugMover';

describe('DebugMover', () => {
  it('moves along its heading at its speed', () => {
    const mover = new DebugMover(
      { position: Vec2.ZERO, heading: Math.PI / 2 },
      { speed: 4, turnRate: 0 },
    );
    mover.step(0.5);
    expect(mover.transform.position.x).toBeCloseTo(2, 10);
    expect(mover.transform.position.z).toBeCloseTo(0, 10);
  });

  it('turns clockwise for a positive turn rate and keeps heading wrapped', () => {
    const mover = new DebugMover({ position: Vec2.ZERO, heading: 3 }, { speed: 0, turnRate: 1 });
    mover.step(0.5);
    // 3.5 rad is past π, so it wraps to 3.5 − 2π.
    expect(mover.transform.heading).toBeCloseTo(3.5 - 2 * Math.PI, 10);
  });
});
