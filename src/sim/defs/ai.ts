import type { AiDef } from '../ai/AiDef';
import type { NavGridOptions } from '../ai/NavGrid';
import { degToRad } from '../core/angles';

// AI tuning (GDD §5, M4 plan). Starting values: edit and save to try them in play.

/**
 * The navigation grid (M4 plan D2): 0.5 u cells; every point of an open cell
 * is at least 1.0 u from walls and cover (tank half-width 0.8 + margin), so a
 * tank anywhere on a path keeps its hull clear while driving past.
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

/** The slice's insurgent (M4 plan starting values). */
export const INSURGENT_AI: AiDef = {
  driving: {
    lookAhead: 2,
    fullTurnAngle: degToRad(25),
    turnInPlaceAngle: degToRad(60),
    slowRadius: 2,
    minThrottle: 0.25,
    arriveRadius: 0.5,
    stuck: {
      window: 1,
      minDistance: 0.3,
      minTurn: degToRad(15),
      reverseTime: 0.6,
      maxAttempts: 3,
    },
  },
  engage: {
    rings: [8, 10, 12],
    samplesPerRing: 24,
    replanInterval: 0.5,
    hullTolerance: degToRad(15),
    turretTolerance: degToRad(2),
    lostSightTime: 1.5,
    behindAngle: degToRad(135),
    behindDistance: 8,
    maxRange: 16,
    aimLead: 0,
    allySpacing: 4,
    allyPenalty: 6,
    coverRadius: 2,
    coverBonus: 4,
    minMove: 3,
  },
};
