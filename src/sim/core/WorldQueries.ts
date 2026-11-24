import type { NavGrid } from '../ai/NavGrid';
import { Pathfinder } from '../ai/Pathfinder';
import { SIGHT, VEHICLE_AVOIDANCE } from '../defs/ai';
import type { PhysicsBridge } from '../physics/PhysicsBridge';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Vehicle } from '../vehicles/Vehicle';
import type { VehicleView } from '../vehicles/VehicleView';
import type { EntityId } from './Entity';
import type { SightLine, SimQueries } from './SimQueries';
import type { Vec2 } from './Vec2';
import type { World } from './World';

/**
 * The simulation's answer to `SimQueries` (M4 plan D1). Holds references to
 * the world and physics but exposes only reads: vehicles come back typed as
 * `VehicleView`, and the queries never step, move or remove anything.
 */
export class WorldQueries implements SimQueries {
  private readonly pathfinder = new Pathfinder();

  constructor(
    private readonly world: World,
    private readonly physics: PhysicsWorld,
    private readonly bodies: PhysicsBridge,
    private readonly currentNavGrid: () => NavGrid | undefined,
  ) {}

  get navGrid(): NavGrid | undefined {
    return this.currentNavGrid();
  }

  vehicles(): readonly VehicleView[] {
    return this.world.ofType(Vehicle);
  }

  vehicle(id: EntityId): VehicleView | undefined {
    const entity = this.world.get(id);
    return entity instanceof Vehicle ? entity : undefined;
  }

  lineOfSight(from: Vec2, to: Vec2, line: SightLine = {}): boolean {
    const ignore = line.viewer === undefined ? undefined : this.bodies.bodyOf(line.viewer);
    const hit = this.physics.castCircle(from, to, SIGHT.radius, ignore);
    if (hit === undefined) {
      return true;
    }
    return line.target !== undefined && this.bodies.entityOf(hit.body)?.id === line.target;
  }

  firstVehicleHit(
    from: Vec2,
    to: Vec2,
    radius: number,
    shooter?: EntityId,
  ): VehicleView | undefined {
    const ignore = shooter === undefined ? undefined : this.bodies.bodyOf(shooter);
    const hit = this.physics.castCircle(from, to, radius, ignore);
    const entity = hit === undefined ? undefined : this.bodies.entityOf(hit.body);
    return entity instanceof Vehicle ? entity : undefined;
  }

  findPath(from: Vec2, to: Vec2, forVehicle?: EntityId): readonly Vec2[] | undefined {
    const grid = this.navGrid;
    if (grid === undefined) {
      return undefined;
    }
    if (forVehicle === undefined) {
      return this.pathfinder.findPath(grid, from, to);
    }
    const others = this.world
      .ofType(Vehicle)
      .filter((vehicle) => vehicle.id !== forVehicle)
      .map((vehicle) => vehicle.transform.position);
    const { radius, cost } = VEHICLE_AVOIDANCE;
    return this.pathfinder.findPath(grid, from, to, (cell) => {
      const centre = grid.centreOf(cell);
      return others.some((position) => position.distanceTo(centre) < radius) ? cost : 0;
    });
  }
}
