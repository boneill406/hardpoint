import { describe, expect, it } from 'vitest';
import { Entity } from '../../../src/sim/core/Entity';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';

class Marker extends Entity {
  moveTo(transform: Transform): void {
    this.setTransform(transform);
  }
}

const START = { position: new Vec2(1, 2), heading: 0.5 };
const MOVED = { position: new Vec2(3, 4), heading: 1 };

describe('Entity', () => {
  it('starts with previousTransform equal to transform, so a new entity renders where it spawned', () => {
    const marker = new Marker(START);
    expect(marker.transform).toBe(START);
    expect(marker.previousTransform).toBe(START);
  });

  it('saveTransform keeps the current transform as previous before the entity moves', () => {
    const marker = new Marker(START);
    marker.saveTransform();
    marker.moveTo(MOVED);
    expect(marker.previousTransform).toBe(START);
    expect(marker.transform).toBe(MOVED);
  });

  it('has no id until a World assigns one', () => {
    const marker = new Marker(START);
    expect(() => marker.id).toThrow('no id');
    marker.assignId(5);
    expect(marker.id).toBe(5);
  });

  it('snapshot flattens id and transform into plain numbers', () => {
    const marker = new Marker(START);
    marker.assignId(5);
    expect(marker.snapshot()).toEqual({ id: 5, x: 1, z: 2, heading: 0.5 });
  });
});
