import { describe, expect, it } from 'vitest';
import { CameraShake } from '../../src/render/camera/CameraShake';

const DEF = { decayPerSecond: 2, maxOffset: 1, frequency: 10 };

describe('CameraShake', () => {
  it('is still with no trauma', () => {
    expect(new CameraShake(DEF).update(1 / 60)).toEqual({ x: 0, y: 0 });
  });

  it('trauma decays steadily to zero, and the shake with it', () => {
    const shake = new CameraShake(DEF);
    shake.add(0.5);
    shake.update(0.1);
    expect(shake.level).toBeCloseTo(0.3, 9);
    shake.update(1);
    expect(shake.level).toBe(0);
    expect(shake.update(1 / 60)).toEqual({ x: 0, y: 0 });
  });

  it('shakes by trauma squared: half the trauma is a quarter of the shake', () => {
    const big = new CameraShake({ ...DEF, decayPerSecond: 0 });
    const small = new CameraShake({ ...DEF, decayPerSecond: 0 });
    big.add(1);
    small.add(0.5);
    const a = big.update(0.05);
    const b = small.update(0.05);
    expect(b.x / a.x).toBeCloseTo(0.25, 9);
  });

  it('never exceeds max offset; trauma caps at 1', () => {
    const shake = new CameraShake({ ...DEF, decayPerSecond: 0 });
    shake.add(5);
    expect(shake.level).toBe(1);
    for (let i = 0; i < 200; i++) {
      const { x, y } = shake.update(1 / 60);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });
});
