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

  it('every point of an open cell is at least the clearance from every obstacle', () => {
    const crate = { center: new Vec2(3, -4), width: 1.5, depth: 1.5 };
    const grid = new NavGrid(BOUNDS, [PILLAR, crate], OPTIONS);
    const half = OPTIONS.cellSize / 2;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!grid.isOpen(col, row)) continue;
        const centre = grid.centreOf({ col, row });
        for (const [dx, dz] of [
          [-half, -half],
          [half, -half],
          [-half, half],
          [half, half],
        ] as const) {
          const corner = centre.add(new Vec2(dx, dz));
          for (const box of [PILLAR, crate]) {
            const gx = Math.max(Math.abs(corner.x - box.center.x) - box.width / 2, 0);
            const gz = Math.max(Math.abs(corner.z - box.center.z) - box.depth / 2, 0);
            expect(Math.hypot(gx, gz)).toBeGreaterThanOrEqual(OPTIONS.clearance - 1e-9);
          }
        }
      }
    }
  });

  it('blocks a cell whose far side is clear but whose near side is too close', () => {
    const grid = new NavGrid(BOUNDS, [PILLAR], OPTIONS);
    // Pillar face at x = 1. The cell x 2.0–2.5 has its near edge 1.0 away, but corners are
    // tested from the centre with half the diagonal added, so it is blocked; x 2.5–3.0 is open.
    expect(grid.isOpenAt(new Vec2(0, 0))).toBe(false);
    expect(grid.isOpenAt(new Vec2(2.25, 0))).toBe(false);
    expect(grid.isOpenAt(new Vec2(2.75, 0))).toBe(true);
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
    // The nearest open cells start 2.5 u out along an axis.
    expect(grid.centreOf(near).length()).toBeLessThan(3);
  });

  it('nearestOpen returns undefined when nothing is open', () => {
    const wall = { center: Vec2.ZERO, width: 30, depth: 30 };
    expect(new NavGrid(BOUNDS, [wall], OPTIONS).nearestOpen(Vec2.ZERO)).toBeUndefined();
  });
});
