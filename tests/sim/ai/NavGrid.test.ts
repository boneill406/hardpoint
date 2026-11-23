import { describe, expect, it } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import { Vec2 } from '../../../src/sim/core/Vec2';

/** 20 × 20 floor centred on the origin, 0.5 u cells, 1 u clearance (the game's values). */
const BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const OPTIONS = { cellSize: 0.5, clearance: 1.0 };
const PILLAR = { center: new Vec2(0, 0), width: 2, depth: 2 };

describe('NavGrid', () => {
  it('covers the floor in cells of the given size', () => {
    const grid = new NavGrid(BOUNDS, [], OPTIONS);
    expect([grid.cols, grid.rows]).toEqual([40, 40]);
    expect(grid.cellAt(new Vec2(-10, -10))).toEqual({ col: 0, row: 0 });
    expect(grid.cellAt(new Vec2(9.99, 9.99))).toEqual({ col: 39, row: 39 });
    expect(grid.cellAt(new Vec2(10.1, 0))).toBeUndefined();
    expect(grid.centreOf({ col: 0, row: 0 })).toEqual(new Vec2(-9.75, -9.75));
  });

  it('blocks cells whose centre is within the clearance of an obstacle, and only those', () => {
    const grid = new NavGrid(BOUNDS, [PILLAR], OPTIONS);
    // Pillar face at x = 1: centres at x = 1.75 (0.75 away) blocked, 2.25 (1.25 away) open.
    expect(grid.isOpenAt(new Vec2(0, 0))).toBe(false);
    expect(grid.isOpenAt(new Vec2(1.75, 0))).toBe(false);
    expect(grid.isOpenAt(new Vec2(2.25, 0))).toBe(true);
    // Corners are rounded: (1.75, 1.75) is √(0.75² + 0.75²) ≈ 1.06 from the corner.
    expect(grid.isOpenAt(new Vec2(1.75, 1.75))).toBe(true);
  });

  it('cells off the grid count as blocked', () => {
    const grid = new NavGrid(BOUNDS, [], OPTIONS);
    expect(grid.isOpen(-1, 0)).toBe(false);
    expect(grid.isOpen(0, 40)).toBe(false);
    expect(grid.isOpenAt(new Vec2(0, 11))).toBe(false);
  });

  it('a segment is open only if it never crosses a blocked cell', () => {
    const grid = new NavGrid(BOUNDS, [PILLAR], OPTIONS);
    expect(grid.segmentOpen(new Vec2(-5, 3), new Vec2(5, 3))).toBe(true);
    expect(grid.segmentOpen(new Vec2(-5, 0), new Vec2(5, 0))).toBe(false);
  });

  it('finds the nearest open cell to a point inside cover', () => {
    const grid = new NavGrid(BOUNDS, [PILLAR], OPTIONS);
    const near = grid.nearestOpen(new Vec2(0.4, 0.1));
    expect(near).toBeDefined();
    if (near === undefined) return;
    expect(grid.isOpen(near.col, near.row)).toBe(true);
    // The nearest clear centres are 2.25 u out along an axis.
    expect(grid.centreOf(near).length()).toBeLessThan(2.5);
  });

  it('nearestOpen returns undefined when nothing is open', () => {
    const wall = { center: Vec2.ZERO, width: 30, depth: 30 };
    expect(new NavGrid(BOUNDS, [wall], OPTIONS).nearestOpen(Vec2.ZERO)).toBeUndefined();
  });
});
