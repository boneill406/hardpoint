import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/sim/arena/Arena';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { Prop } from '../../../src/sim/arena/Prop';
import { EventBus } from '../../../src/sim/core/EventBus';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Simulation } from '../../../src/sim/core/Simulation';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { World } from '../../../src/sim/core/World';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';
import { drive, scriptedTank } from '../vehicles/testVehicles';

const TEST_ARENA: ArenaDef = {
  name: 'Test arena',
  width: 20,
  depth: 10,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: new Vec2(0, -3), heading: 0 },
  gates: [],
  pillars: [{ center: new Vec2(-5, 0), width: 2, depth: 2 }],
  crates: [
    { center: new Vec2(3, 1), width: 1, depth: 1 },
    { center: new Vec2(6, -2), width: 1, depth: 1 },
  ],
};

describe('Arena', () => {
  describe('walls', () => {
    const arena = new Arena(TEST_ARENA);

    it('has four walls whose inner faces are the floor edges', () => {
      const innerFaces = arena.walls.map((wall) => ({
        top: wall.center.z - wall.depth / 2,
        bottom: wall.center.z + wall.depth / 2,
        right: wall.center.x - wall.width / 2,
        left: wall.center.x + wall.width / 2,
      }));
      expect(innerFaces[0]?.top).toBe(5);
      expect(innerFaces[1]?.bottom).toBe(-5);
      expect(innerFaces[2]?.right).toBe(10);
      expect(innerFaces[3]?.left).toBe(-10);
    });

    it('end walls span the side walls too, so the corners have no gaps', () => {
      const [top] = arena.walls;
      expect(top?.width).toBe(20 + 2 * 1);
    });
  });

  it('contains points on the floor and not beyond the walls', () => {
    const arena = new Arena(TEST_ARENA);
    expect(arena.contains(new Vec2(9.9, -4.9))).toBe(true);
    expect(arena.contains(new Vec2(10.1, 0))).toBe(false);
    expect(arena.contains(new Vec2(0, 5.1))).toBe(false);
  });

  it('spawns pillars then crates as props, in def order, with their sizes and destructibility', () => {
    const world = new World(new EventBus<SimEvents>());
    new Arena(TEST_ARENA).spawnProps(world);

    const props = world.ofType(Prop);
    expect(props.map((prop) => [prop.id, prop.kind, prop.destructible])).toEqual([
      [1, 'pillar', false],
      [2, 'crate', true],
      [3, 'crate', true],
    ]);
    expect(props[1]?.transform.position).toEqual(new Vec2(3, 1));
    expect(props[0]?.size).toEqual({ width: 2, depth: 2 });
  });
});

describe('Simulation with an arena', () => {
  it('spawns the arena props before populate, so their ids come first', () => {
    const simulation = new Simulation({
      seed: 1,
      physics: new FakePhysicsWorld(),
      arena: TEST_ARENA,
      populate: (sim) => {
        sim.world.add(scriptedTank(drive(0)));
      },
    });
    expect(simulation.arena?.def).toBe(TEST_ARENA);
    expect(simulation.world.ofType(Prop)).toHaveLength(3);
    expect(simulation.world.ofType(Vehicle)[0]?.id).toBe(4);
  });

  it('has no arena when none is given', () => {
    const simulation = new Simulation({ seed: 1, physics: new FakePhysicsWorld() });
    expect(simulation.arena).toBeUndefined();
    expect(simulation.world.all()).toEqual([]);
  });
});
