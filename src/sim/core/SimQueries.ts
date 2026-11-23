import type { NavGrid } from '../ai/NavGrid';
import type { VehicleView } from '../vehicles/VehicleView';
import type { EntityId } from './Entity';
import type { Vec2 } from './Vec2';

/** Who is looking and at what, for `lineOfSight`. */
export interface SightLine {
  /** The looker: its own hull and barrels never block its view. */
  readonly viewer?: EntityId;
  /** The thing looked at: reaching it counts as clear, even if the ray touches it first. */
  readonly target?: EntityId;
}

/**
 * What a controller may ask about the world (M4 plan D1): read-only queries
 * answered by the simulation inside the tick, so answers are deterministic and
 * nothing a controller does can change state. AI tests can pass a small fake.
 */
export interface SimQueries {
  /** Every live vehicle, in world order. */
  vehicles(): readonly VehicleView[];
  vehicle(id: EntityId): VehicleView | undefined;
  /**
   * True if nothing solid lies between `from` and `to` (walls, cover, other
   * tanks), testing a thin circle swept along the line (M4 plan D5).
   */
  lineOfSight(from: Vec2, to: Vec2, line?: SightLine): boolean;
  /**
   * Waypoints from `from` to `to` (see `Pathfinder.findPath`). With `forVehicle`,
   * cells near every *other* vehicle cost extra, so tanks route around each
   * other (plan D6). Undefined if there is no way.
   */
  findPath(from: Vec2, to: Vec2, forVehicle?: EntityId): readonly Vec2[] | undefined;
  /** The current navigation grid (replaced when cover breaks), undefined without an arena. */
  readonly navGrid: NavGrid | undefined;
}
