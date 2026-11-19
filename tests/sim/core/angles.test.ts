import { describe, expect, it } from 'vitest';
import { angleDelta, degToRad, lerpAngle, wrapAngle } from '../../../src/sim/core/angles';

const PI = Math.PI;

describe('degToRad', () => {
  it('converts GDD degrees to radians', () => {
    expect(degToRad(180)).toBeCloseTo(PI, 12);
    expect(degToRad(45)).toBeCloseTo(PI / 4, 12);
    expect(degToRad(-90)).toBeCloseTo(-PI / 2, 12);
  });
});

describe('wrapAngle', () => {
  it('leaves angles already in [-π, π) unchanged', () => {
    for (const a of [0, 1, -1, 3, -3, -PI]) {
      expect(wrapAngle(a)).toBeCloseTo(a, 12);
    }
  });

  it('wraps π to -π so the range is half-open', () => {
    expect(wrapAngle(PI)).toBeCloseTo(-PI, 12);
  });

  it('wraps angles that accumulated past a full turn', () => {
    expect(wrapAngle(2 * PI + 0.5)).toBeCloseTo(0.5, 12);
    expect(wrapAngle(-2 * PI - 0.5)).toBeCloseTo(-0.5, 12);
    expect(wrapAngle(7 * PI + 0.25)).toBeCloseTo(-PI + 0.25, 12);
  });
});

describe('angleDelta', () => {
  it('is positive when the shortest turn is toward +x (clockwise)', () => {
    expect(angleDelta(0, degToRad(30))).toBeCloseTo(degToRad(30), 12);
  });

  it('takes the short way across the ±180° seam', () => {
    expect(angleDelta(degToRad(170), degToRad(-170))).toBeCloseTo(degToRad(20), 12);
    expect(angleDelta(degToRad(-170), degToRad(170))).toBeCloseTo(degToRad(-20), 12);
  });

  it('is zero for the same heading expressed a full turn apart', () => {
    expect(angleDelta(0.3, 0.3 + 2 * PI)).toBeCloseTo(0, 12);
  });
});

describe('lerpAngle', () => {
  it('170° → -170° passes through 180°, not 0°', () => {
    const halfway = lerpAngle(degToRad(170), degToRad(-170), 0.5);
    expect(Math.abs(halfway)).toBeCloseTo(PI, 12);
  });

  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(lerpAngle(0.2, 1.4, 0)).toBeCloseTo(0.2, 12);
    expect(lerpAngle(0.2, 1.4, 1)).toBeCloseTo(1.4, 12);
  });

  it('interpolates linearly along the short arc', () => {
    expect(lerpAngle(degToRad(170), degToRad(-170), 0.25)).toBeCloseTo(degToRad(175), 12);
  });
});
