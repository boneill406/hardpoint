import type { NavGridOptions } from '../ai/NavGrid';

// AI tuning (GDD §5, M4 plan). Per-enemy behaviour (`AiDef`) joins this file in M4-4.

/**
 * The navigation grid (M4 plan D2): 0.5 u cells; a cell is blocked within
 * 1.0 u of a wall or cover (tank half-width 0.8 + margin), so a tank centred
 * on an open cell keeps its hull clear while driving past.
 */
export const NAV_GRID: NavGridOptions = { cellSize: 0.5, clearance: 1.0 };

/** Line of sight (M4 plan D5): a thin circle swept along the line, so a shot-width gap counts as clear. */
export const SIGHT = { radius: 0.1 };

/**
 * Other tanks in pathfinding (M4 plan D6): cells within `radius` (u) of
 * another vehicle's centre cost `cost` extra each (a cell step costs 1), so
 * paths bend around tanks without treating them as walls.
 */
export const VEHICLE_AVOIDANCE = { radius: 2.5, cost: 4 };
