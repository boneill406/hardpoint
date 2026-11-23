import type { BoxDef } from '../arena/ArenaDef';
import { Vec2 } from '../core/Vec2';

export interface NavGridOptions {
  /** Cell edge (u). */
  readonly cellSize: number;
  /** A cell is blocked if its centre is closer than this (u) to an obstacle. */
  readonly clearance: number;
}

/** A grid cell by column (along x) and row (along z). */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** The floor the grid covers, in world units. */
export interface FloorBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Where tanks can drive, as a grid of open and blocked cells (M4 plan D2).
 * Built from the simulation's own shapes (CLAUDE.md rule 5): walls, pillars
 * and the crates still standing. Each obstacle is grown by `clearance`, so the
 * pathfinder can treat a tank as a point on the grid. Immutable: when a crate
 * breaks, the simulation builds a new one.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(
    readonly bounds: FloorBounds,
    obstacles: readonly BoxDef[],
    readonly options: NavGridOptions,
  ) {
    const { cellSize } = options;
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const centre = this.centreOf({ col, row });
        if (obstacles.some((box) => distanceToBox(centre, box) < options.clearance)) {
          this.blocked[this.index(col, row)] = 1;
        }
      }
    }
  }

  /** Cells outside the grid count as blocked. */
  isOpen(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return false;
    }
    return this.blocked[this.index(col, row)] === 0;
  }

  /** The cell containing `point`, or undefined off the grid. */
  cellAt(point: Vec2): Cell | undefined {
    const { cellSize } = this.options;
    const col = Math.floor((point.x - this.bounds.minX) / cellSize);
    const row = Math.floor((point.z - this.bounds.minZ) / cellSize);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return undefined;
    }
    return { col, row };
  }

  isOpenAt(point: Vec2): boolean {
    const cell = this.cellAt(point);
    return cell !== undefined && this.isOpen(cell.col, cell.row);
  }

  centreOf(cell: Cell): Vec2 {
    const { cellSize } = this.options;
    return new Vec2(
      this.bounds.minX + (cell.col + 0.5) * cellSize,
      this.bounds.minZ + (cell.row + 0.5) * cellSize,
    );
  }

  /**
   * True if every point on the segment lies in an open cell (sampled every
   * quarter cell). Used to straighten paths; the clearance margin covers what
   * sampling could miss at a corner.
   */
  segmentOpen(from: Vec2, to: Vec2): boolean {
    return this.everyCellOnSegment(from, to, () => true);
  }

  /** True if every point on the segment (sampled every quarter cell) is in an open cell passing `test`. */
  everyCellOnSegment(from: Vec2, to: Vec2, test: (cell: Cell) => boolean): boolean {
    const length = from.distanceTo(to);
    const steps = Math.max(1, Math.ceil(length / (this.options.cellSize / 4)));
    for (let i = 0; i <= steps; i++) {
      const cell = this.cellAt(from.lerp(to, i / steps));
      if (cell === undefined || !this.isOpen(cell.col, cell.row) || !test(cell)) {
        return false;
      }
    }
    return true;
  }

  /**
   * The open cell nearest to `point` (searching outward ring by ring, nearest
   * centre within the first ring that has one), or undefined if none is open.
   * Lets a tank spawned against a wall, or a goal inside cover, still get a path.
   */
  nearestOpen(point: Vec2): Cell | undefined {
    const start = this.clampedCell(point);
    const maxRing = Math.max(this.cols, this.rows);
    for (let ring = 0; ring <= maxRing; ring++) {
      let best: Cell | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let row = start.row - ring; row <= start.row + ring; row++) {
        for (let col = start.col - ring; col <= start.col + ring; col++) {
          const onRing = Math.max(Math.abs(col - start.col), Math.abs(row - start.row)) === ring;
          if (!onRing || !this.isOpen(col, row)) {
            continue;
          }
          const distance = this.centreOf({ col, row }).distanceTo(point);
          if (distance < bestDistance) {
            best = { col, row };
            bestDistance = distance;
          }
        }
      }
      if (best !== undefined) {
        return best;
      }
    }
    return undefined;
  }

  /** Row-major cell index, for the pathfinder's flat arrays. */
  index(col: number, row: number): number {
    return row * this.cols + col;
  }

  private clampedCell(point: Vec2): Cell {
    const { cellSize } = this.options;
    const col = Math.floor((point.x - this.bounds.minX) / cellSize);
    const row = Math.floor((point.z - this.bounds.minZ) / cellSize);
    return {
      col: Math.min(this.cols - 1, Math.max(0, col)),
      row: Math.min(this.rows - 1, Math.max(0, row)),
    };
  }
}

/** Distance from `point` to an axis-aligned box (0 inside it). */
function distanceToBox(point: Vec2, box: BoxDef): number {
  const dx = Math.max(Math.abs(point.x - box.center.x) - box.width / 2, 0);
  const dz = Math.max(Math.abs(point.z - box.center.z) - box.depth / 2, 0);
  return Math.hypot(dx, dz);
}
