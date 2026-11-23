import type { Vec2 } from '../core/Vec2';
import type { Cell, NavGrid } from './NavGrid';

/** Extra cost (≥ 0) for entering a cell, e.g. near another tank (M4 plan D6). */
export type CellCost = (cell: Cell) => number;

const DIAGONAL = Math.SQRT2;
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Grid A* (M4 plan D3): 8-connected, octile-distance heuristic, never cutting a
 * blocked corner. The cell path is then straightened (waypoints dropped while
 * the straight line stays on open cells), so tanks drive lines, not staircases.
 *
 * Deterministic: ties in the open list break by insertion order, never by
 * object or hash order.
 */
export class Pathfinder {
  /**
   * Waypoints from `from` to `to` (world units), excluding the start, ending at
   * the goal. A start or goal inside blocked cells is moved to the nearest open
   * cell. Undefined if no path exists.
   */
  findPath(grid: NavGrid, from: Vec2, to: Vec2, extraCost?: CellCost): Vec2[] | undefined {
    const startOpen = grid.isOpenAt(from);
    const start = startOpen ? grid.cellAt(from) : grid.nearestOpen(from);
    const goalOpen = grid.isOpenAt(to);
    const goal = goalOpen ? grid.cellAt(to) : grid.nearestOpen(to);
    if (start === undefined || goal === undefined) {
      return undefined;
    }
    const cells = search(grid, start, goal, extraCost);
    if (cells === undefined) {
      return undefined;
    }
    const points = cells.map((cell) => grid.centreOf(cell));
    if (goalOpen) {
      points[points.length - 1] = to;
    }
    // From an open start, straighten from the real position; from a blocked one,
    // first drive to the nearest open cell's centre.
    const anchor = startOpen ? from : grid.centreOf(start);
    const costs = cells.map((cell) => extraCost?.(cell) ?? 0);
    const smoothed = smooth(grid, anchor, points.slice(1), costs, extraCost);
    return startOpen ? smoothed : [anchor, ...smoothed];
  }
}

function search(
  grid: NavGrid,
  start: Cell,
  goal: Cell,
  extraCost: CellCost | undefined,
): Cell[] | undefined {
  const size = grid.cols * grid.rows;
  const cost = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new OpenList();
  const startIndex = grid.index(start.col, start.row);
  const goalIndex = grid.index(goal.col, goal.row);
  cost[startIndex] = 0;
  open.push(startIndex, octile(start, goal));

  for (let current = open.pop(); current !== undefined; current = open.pop()) {
    if (current === goalIndex) {
      return trace(grid, parent, goalIndex);
    }
    if (closed[current] === 1) {
      continue;
    }
    closed[current] = 1;
    const col = current % grid.cols;
    const row = Math.floor(current / grid.cols);
    for (const [dc, dr] of NEIGHBOURS) {
      const next = { col: col + dc, row: row + dr };
      if (!grid.isOpen(next.col, next.row)) {
        continue;
      }
      const diagonal = dc !== 0 && dr !== 0;
      if (diagonal && (!grid.isOpen(col + dc, row) || !grid.isOpen(col, row + dr))) {
        continue; // never cut a blocked corner
      }
      const nextIndex = grid.index(next.col, next.row);
      const step = (diagonal ? DIAGONAL : 1) + (extraCost?.(next) ?? 0);
      const candidate = (cost[current] ?? 0) + step;
      if (candidate < (cost[nextIndex] ?? Number.POSITIVE_INFINITY)) {
        cost[nextIndex] = candidate;
        parent[nextIndex] = current;
        open.push(nextIndex, candidate + octile(next, goal));
      }
    }
  }
  return undefined;
}

function trace(grid: NavGrid, parent: Int32Array, goalIndex: number): Cell[] {
  const cells: Cell[] = [];
  for (let index = goalIndex; index !== -1; index = parent[index] ?? -1) {
    cells.push({ col: index % grid.cols, row: Math.floor(index / grid.cols) });
  }
  return cells.reverse();
}

/** Cell-step distance allowing diagonals: exact on an empty grid, so A* stays optimal. */
function octile(a: Cell, b: Cell): number {
  const dx = Math.abs(a.col - b.col);
  const dz = Math.abs(a.row - b.row);
  return Math.max(dx, dz) + (DIAGONAL - 1) * Math.min(dx, dz);
}

/**
 * Greedy string-pulling: from each anchor, jump to the furthest point still in
 * open, straight line. A shortcut may not cross cells costlier than the worst
 * one on the stretch of path it replaces, so straightening never undoes what
 * the extra cost steered around.
 *
 * `costs[k]` is the extra cost of the k-th cell of the raw path; `points[k]` is
 * that path's (k + 1)-th cell, since the start cell is dropped.
 */
function smooth(
  grid: NavGrid,
  anchor: Vec2,
  points: readonly Vec2[],
  costs: readonly number[],
  extraCost: CellCost | undefined,
): Vec2[] {
  const result: Vec2[] = [];
  let from = anchor;
  let fromCell = 0;
  let i = 0;
  while (i < points.length) {
    let furthest = i;
    for (let j = points.length - 1; j > i; j--) {
      const target = points[j];
      const allowed = Math.max(...costs.slice(fromCell, j + 2));
      const withinCost = (cell: Cell): boolean => (extraCost?.(cell) ?? 0) <= allowed;
      if (target !== undefined && grid.everyCellOnSegment(from, target, withinCost)) {
        furthest = j;
        break;
      }
    }
    const next = points[furthest];
    if (next === undefined) {
      break;
    }
    result.push(next);
    from = next;
    fromCell = furthest + 1;
    i = furthest + 1;
  }
  return result;
}

interface OpenEntry {
  readonly index: number;
  readonly priority: number;
  readonly order: number;
}

/** Binary min-heap of cell indices by priority; equal priorities pop in insertion order. */
class OpenList {
  private readonly items: OpenEntry[] = [];
  private counter = 0;

  push(index: number, priority: number): void {
    this.items.push({ index, priority, order: this.counter++ });
    this.up(this.items.length - 1);
  }

  pop(): number | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top === undefined || last === undefined) {
      return undefined;
    }
    if (this.items.length > 0) {
      this.items[0] = last;
      this.down(0);
    }
    return top.index;
  }

  private less(a: number, b: number): boolean {
    const x = this.items[a];
    const y = this.items[b];
    if (x === undefined || y === undefined) {
      return false;
    }
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }

  private swap(a: number, b: number): void {
    const x = this.items[a];
    const y = this.items[b];
    if (x !== undefined && y !== undefined) {
      this.items[a] = y;
      this.items[b] = x;
    }
  }

  private up(start: number): void {
    let child = start;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (!this.less(child, parent)) {
        return;
      }
      this.swap(child, parent);
      child = parent;
    }
  }

  private down(start: number): void {
    let parent = start;
    for (;;) {
      const left = 2 * parent + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < this.items.length && this.less(left, smallest)) {
        smallest = left;
      }
      if (right < this.items.length && this.less(right, smallest)) {
        smallest = right;
      }
      if (smallest === parent) {
        return;
      }
      this.swap(parent, smallest);
      parent = smallest;
    }
  }
}
