import { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { BoxDef } from '../../../src/sim/arena/ArenaDef';
import type { SimQueries, SightLine } from '../../../src/sim/core/SimQueries';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { NAV_GRID } from '../../../src/sim/defs/ai';
import { INSURGENT_TANK } from '../../../src/sim/defs/vehicles';
import type { Faction } from '../../../src/sim/vehicles/Faction';
import type { VehicleView } from '../../../src/sim/vehicles/VehicleView';

/** A vehicle view the test can move and turn by hand. */
export interface FakeVehicle extends VehicleView {
  transform: Transform;
  linearVelocity: Vec2;
  turret: { heading: number };
  health: { current: number; max: number; depleted: boolean };
}

export function fakeVehicle(
  id: number,
  faction: Faction,
  position: Vec2,
  heading = 0,
): FakeVehicle {
  const vehicle: FakeVehicle = {
    id,
    def: INSURGENT_TANK,
    faction,
    transform: { position, heading },
    linearVelocity: Vec2.ZERO,
    angularVelocity: 0,
    health: { current: 60, max: 60, depleted: false },
    turret: { heading },
    turretPivot: () => vehicle.transform.position,
  };
  return vehicle;
}

/** A 40 × 40 world with real nav-grid rules, hand-placed vehicles and a sight rule the test controls. */
export class FakeWorld implements SimQueries {
  readonly navGrid: NavGrid;
  readonly list: FakeVehicle[] = [];
  /** Decides every sight query; default: always clear. */
  sight: (from: Vec2, to: Vec2, line?: SightLine) => boolean = () => true;

  constructor(cover: readonly BoxDef[] = []) {
    this.navGrid = new NavGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, cover, NAV_GRID);
  }

  add(vehicle: FakeVehicle): FakeVehicle {
    this.list.push(vehicle);
    return vehicle;
  }

  vehicles(): readonly VehicleView[] {
    return this.list;
  }

  vehicle(id: number): VehicleView | undefined {
    return this.list.find((vehicle) => vehicle.id === id);
  }

  lineOfSight(from: Vec2, to: Vec2, line?: SightLine): boolean {
    return this.sight(from, to, line);
  }

  /** Straight to the goal: these tests are about decisions, not routes. */
  findPath(_from: Vec2, to: Vec2): readonly Vec2[] | undefined {
    return [to];
  }
}
