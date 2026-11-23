import type { NavGridOptions } from '../ai/NavGrid';

// AI tuning (GDD §5, M4 plan). Per-enemy behaviour (`AiDef`) joins this file in M4-4.

/**
 * The navigation grid (M4 plan D2): 0.5 u cells; a cell is blocked within
 * 1.0 u of a wall or cover (tank half-width 0.8 + margin), so a tank centred
 * on an open cell keeps its hull clear while driving past.
 */
export const NAV_GRID: NavGridOptions = { cellSize: 0.5, clearance: 1.0 };
