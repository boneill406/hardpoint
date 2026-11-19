import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../../src/sim/core/Vec2';

function expectVec(actual: Vec2, x: number, z: number): void {
  expect(actual.x).toBeCloseTo(x, 10);
  expect(actual.z).toBeCloseTo(z, 10);
}

describe('Vec2', () => {
  describe('heading convention', () => {
    it('heading 0 points up-screen along +z', () => {
      expectVec(Vec2.fromHeading(0), 0, 1);
    });

    it('heading π/2 points along +x (clockwise seen from above)', () => {
      expectVec(Vec2.fromHeading(Math.PI / 2), 1, 0);
    });

    it('heading π points down-screen along -z', () => {
      expectVec(Vec2.fromHeading(Math.PI), 0, -1);
    });

    it('heading() inverts fromHeading', () => {
      for (const h of [0, 0.3, Math.PI / 2, 2.5, -1, -Math.PI / 2]) {
        expect(Vec2.fromHeading(h).heading()).toBeCloseTo(h, 10);
      }
    });

    it('rotating +z by π/2 gives +x, matching fromHeading', () => {
      expectVec(new Vec2(0, 1).rotate(Math.PI / 2), 1, 0);
    });

    it('rotating a heading vector adds to its heading', () => {
      const rotated = Vec2.fromHeading(0.4).rotate(0.7);
      expectVec(rotated, Math.sin(1.1), Math.cos(1.1));
    });
  });

  describe('arithmetic', () => {
    it('adds, subtracts and scales component-wise', () => {
      const a = new Vec2(1, 2);
      const b = new Vec2(3, -5);
      expectVec(a.add(b), 4, -3);
      expectVec(a.sub(b), -2, 7);
      expectVec(a.scale(3), 3, 6);
    });

    it('measures length, squared length, dot product and distance', () => {
      const v = new Vec2(3, 4);
      expect(v.length()).toBe(5);
      expect(v.lengthSquared()).toBe(25);
      expect(v.dot(new Vec2(2, -1))).toBe(2);
      expect(new Vec2(1, 1).distanceTo(new Vec2(4, 5))).toBe(5);
    });

    it('lerps between two points', () => {
      const a = new Vec2(0, 10);
      const b = new Vec2(4, 20);
      expectVec(a.lerp(b, 0), 0, 10);
      expectVec(a.lerp(b, 0.25), 1, 12.5);
      expectVec(a.lerp(b, 1), 4, 20);
    });
  });

  describe('normalize', () => {
    it('returns a unit vector in the same direction', () => {
      const n = new Vec2(3, 4).normalize();
      expect(n.length()).toBeCloseTo(1, 10);
      expectVec(n, 0.6, 0.8);
    });

    it('normalizing a zero vector is safe and returns zero, not NaN', () => {
      const n = Vec2.ZERO.normalize();
      expect(n.x).toBe(0);
      expect(n.z).toBe(0);
    });
  });

  it('operations never mutate their operands', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, 4);
    a.add(b);
    a.sub(b);
    a.scale(5);
    a.rotate(1);
    a.lerp(b, 0.5);
    a.normalize();
    expect([a.x, a.z, b.x, b.z]).toEqual([1, 2, 3, 4]);
  });
});
