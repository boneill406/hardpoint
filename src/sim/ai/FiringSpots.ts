import type { SimQueries } from '../core/SimQueries';
import { Vec2 } from '../core/Vec2';
import type { VehicleView } from '../vehicles/VehicleView';
import type { EngageDef } from './AiDef';
import type { NavGrid } from './NavGrid';

/** Extra rules for one search. */
export interface SpotSearch {
  /** Reposition: prefer spots next to cover, and move at least `minMove`. */
  readonly repositioning: boolean;
}

/** How many of the best-scored spots get a real path check before giving up. */
const PATH_CHECKS = 6;

/**
 * Picks where an AI tank should fight from (M4 plan D8): a reachable, open
 * spot on a ring around the target with line of sight to it. Cheapest wins:
 * distance from the tank, plus a penalty near allies (spread out), minus a
 * bonus next to cover when repositioning. Equal scores keep sampling order,
 * so the choice is deterministic without a random draw.
 */
export function chooseFiringSpot(
  world: SimQueries,
  self: VehicleView,
  target: VehicleView,
  def: EngageDef,
  search: SpotSearch,
): Vec2 | undefined {
  const grid = world.navGrid;
  if (grid === undefined) {
    return undefined;
  }
  const allies = world
    .vehicles()
    .filter((vehicle) => vehicle.id !== self.id && vehicle.faction === self.faction)
    .map((vehicle) => vehicle.transform.position);
  const here = self.transform.position;
  const scored: { spot: Vec2; cost: number }[] = [];
  for (const spot of candidates(target.transform.position, def)) {
    if (!grid.isOpenAt(spot)) {
      continue;
    }
    if (search.repositioning && spot.distanceTo(here) < def.minMove) {
      continue;
    }
    const sight = { viewer: self.id, target: target.id };
    if (!world.lineOfSight(spot, target.transform.position, sight)) {
      continue;
    }
    scored.push({ spot, cost: cost(spot, here, allies, grid, def, search) });
  }
  // Stable sort: ties keep sampling order.
  scored.sort((a, b) => a.cost - b.cost);
  for (const { spot } of scored.slice(0, PATH_CHECKS)) {
    if (world.findPath(here, spot, self.id) !== undefined) {
      return spot;
    }
  }
  return undefined;
}

/** Points on each ring around the target, starting due +z and going clockwise. */
function candidates(centre: Vec2, def: EngageDef): Vec2[] {
  const points: Vec2[] = [];
  for (const radius of def.rings) {
    for (let i = 0; i < def.samplesPerRing; i++) {
      const heading = (2 * Math.PI * i) / def.samplesPerRing;
      points.push(centre.add(Vec2.fromHeading(heading).scale(radius)));
    }
  }
  return points;
}

function cost(
  spot: Vec2,
  here: Vec2,
  allies: readonly Vec2[],
  grid: NavGrid,
  def: EngageDef,
  search: SpotSearch,
): number {
  let total = spot.distanceTo(here);
  if (allies.some((ally) => ally.distanceTo(spot) < def.allySpacing)) {
    total += def.allyPenalty;
  }
  if (search.repositioning && coverNear(grid, spot, def.coverRadius)) {
    total -= def.coverBonus;
  }
  return total;
}

/** Any blocked cell within `radius` of `spot`: something to tuck in beside. */
function coverNear(grid: NavGrid, spot: Vec2, radius: number): boolean {
  const step = grid.options.cellSize;
  for (let dz = -radius; dz <= radius; dz += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      if (Math.hypot(dx, dz) <= radius && !grid.isOpenAt(spot.add(new Vec2(dx, dz)))) {
        return true;
      }
    }
  }
  return false;
}
