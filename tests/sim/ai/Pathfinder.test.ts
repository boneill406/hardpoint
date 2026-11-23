import { describe, expect, it } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import { Pathfinder } from '../../../src/sim/ai/Pathfinder';
import type { BoxDef } from '../../../src/sim/arena/ArenaDef';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { NAV_GRID } from '../../../src/sim/defs/ai';

const BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const pathfinder = new Pathfinder();

function gridWith(obstacles: BoxDef[]): NavGrid {
  return new NavGrid(BOUNDS, obstacles, NAV_GRID);
}

/** The path as segments starting from `from`, for checking each leg. */
function legs(from: Vec2, path: readonly Vec2[]): [Vec2, Vec2][] {
  return path.map((point, i) => [i === 0 ? from : (path[i - 1] ?? from), point]);
}

function length(from: Vec2, path: readonly Vec2[]): number {
  return legs(from, path).reduce((sum, [a, b]) => sum + a.distanceTo(b), 0);
}

describe('Pathfinder', () => {
  it('in open ground the path is a single straight leg to the goal', () => {
    const from = new Vec2(-6, -6);
    const to = new Vec2(5, 7);
    expect(pathfinder.findPath(gridWith([]), from, to)).toEqual([to]);
  });

  it('finds a way around a crate in the way, every leg on open cells', () => {
    const crate = { center: new Vec2(0, 0), width: 4, depth: 1.5 };
    const grid = gridWith([crate]);
    const from = new Vec2(0, -6);
    const to = new Vec2(0, 6);
    const path = pathfinder.findPath(grid, from, to);
    expect(path).toBeDefined();
    if (path === undefined) return;
    expect(path.at(-1)).toEqual(to);
    expect(path.length).toBeGreaterThan(1);
    for (const [a, b] of legs(from, path)) {
      expect(grid.segmentOpen(a, b)).toBe(true);
    }
    // Around, within ~10% of the shortest way round the crate kept 1.0 u off
    // (≈ 13.6 u), plus up to a cell of grid rounding.
    expect(length(from, path)).toBeLessThan(15.5);
  });

  it('returns no path into a sealed area, rather than hanging', () => {
    // A ring of walls around (5, 5); the goal inside is open but unreachable.
    const ring: BoxDef[] = [
      { center: new Vec2(5, 8), width: 8, depth: 0.5 },
      { center: new Vec2(5, 2), width: 8, depth: 0.5 },
      { center: new Vec2(2, 5), width: 0.5, depth: 6 },
      { center: new Vec2(8, 5), width: 0.5, depth: 6 },
    ];
    const grid = gridWith(ring);
    expect(grid.isOpenAt(new Vec2(5, 5))).toBe(true);
    expect(pathfinder.findPath(grid, new Vec2(-6, -6), new Vec2(5, 5))).toBeUndefined();
  });

  it('never squeezes diagonally between two blocked cells', () => {
    // 1 u cells, tiny clearance: small blockers in two diagonal cells, so only a
    // diagonal step between them could join the other two cells.
    const grid = new NavGrid(
      { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
      [
        { center: new Vec2(1.5, 0.5), width: 0.2, depth: 0.2 },
        { center: new Vec2(0.5, 1.5), width: 0.2, depth: 0.2 },
      ],
      { cellSize: 1, clearance: 0.1 },
    );
    expect(grid.isOpen(0, 0) && grid.isOpen(1, 1)).toBe(true);
    expect(pathfinder.findPath(grid, new Vec2(0.5, 0.5), new Vec2(1.5, 1.5))).toBeUndefined();
  });

  it('from a start inside cover, it first drives to the nearest open cell', () => {
    const pillar = { center: new Vec2(0, 0), width: 2, depth: 2 };
    const grid = gridWith([pillar]);
    const from = new Vec2(1.5, 0); // within the clearance of the pillar's face
    const path = pathfinder.findPath(grid, from, new Vec2(6, 0));
    const first = path?.[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(grid.isOpenAt(first)).toBe(true);
    expect(first.distanceTo(from)).toBeLessThan(1.5);
  });

  it('a goal inside cover ends at the nearest open cell instead', () => {
    const pillar = { center: new Vec2(0, 0), width: 2, depth: 2 };
    const grid = gridWith([pillar]);
    const end = pathfinder.findPath(grid, new Vec2(-6, -6), new Vec2(0, 0))?.at(-1);
    expect(end).toBeDefined();
    if (end === undefined) return;
    expect(grid.isOpenAt(end)).toBe(true);
    expect(end.length()).toBeLessThan(3);
  });

  it('extra cell cost steers the path around a costly area (other tanks, plan D6)', () => {
    const grid = gridWith([]);
    const from = new Vec2(0, -6);
    const to = new Vec2(0, 6);
    const costly = (cell: { col: number; row: number }): number => {
      const centre = grid.centreOf(cell);
      return centre.length() < 2 ? 50 : 0;
    };
    const path = pathfinder.findPath(grid, from, to, costly);
    expect(path).toBeDefined();
    if (path === undefined) return;
    expect(path.length).toBeGreaterThan(1);
    // No waypoint, and no leg midpoint, passes through the costly disc.
    for (const [a, b] of legs(from, path)) {
      expect(a.lerp(b, 0.5).length()).toBeGreaterThan(1.5);
    }
  });

  it('the same grid and endpoints always give the same path', () => {
    const grid = gridWith([
      { center: new Vec2(0, 0), width: 4, depth: 1.5 },
      { center: new Vec2(-4, 4), width: 1.5, depth: 1.5 },
    ]);
    const a = pathfinder.findPath(grid, new Vec2(-1, -7), new Vec2(2, 7));
    const b = new Pathfinder().findPath(grid, new Vec2(-1, -7), new Vec2(2, 7));
    expect(a).toEqual(b);
  });
});
