import { describe, expect, it } from 'vitest';
import { Entity } from '../../../src/sim/core/Entity';
import { EventBus } from '../../../src/sim/core/EventBus';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { World } from '../../../src/sim/core/World';

const ORIGIN = { position: Vec2.ZERO, heading: 0 };

class Crate extends Entity {}
class Tank extends Entity {}
class HeavyTank extends Tank {}

function createWorld(): { world: World; events: EventBus<SimEvents>; log: string[] } {
  const events = new EventBus<SimEvents>();
  const log: string[] = [];
  events.on('EntitySpawned', ({ id }) => log.push(`spawned ${id}`));
  events.on('EntityDestroyed', ({ id }) => log.push(`destroyed ${id}`));
  return { world: new World(events), events, log };
}

describe('World', () => {
  describe('adding', () => {
    it('assigns ids from 1 in the order entities are added', () => {
      const { world } = createWorld();
      const ids = [new Crate(ORIGIN), new Tank(ORIGIN), new Crate(ORIGIN)].map(
        (entity) => world.add(entity).id,
      );
      expect(ids).toEqual([1, 2, 3]);
    });

    it('get finds an added entity by id', () => {
      const { world } = createWorld();
      const tank = world.add(new Tank(ORIGIN));
      expect(world.get(tank.id)).toBe(tank);
      expect(world.get(99)).toBeUndefined();
    });

    it('queues EntitySpawned for each added entity', () => {
      const { world, events, log } = createWorld();
      world.add(new Crate(ORIGIN));
      world.add(new Tank(ORIGIN));
      events.flush();
      expect(log).toEqual(['spawned 1', 'spawned 2']);
    });

    it('refuses to add the same entity to two worlds', () => {
      const crate = new Crate(ORIGIN);
      createWorld().world.add(crate);
      expect(() => createWorld().world.add(crate)).toThrow('already has id');
    });
  });

  describe('querying', () => {
    it('ofType returns instances of a class in insertion order, including subclasses', () => {
      const { world } = createWorld();
      const tank = world.add(new Tank(ORIGIN));
      world.add(new Crate(ORIGIN));
      const heavy = world.add(new HeavyTank(ORIGIN));
      const tank2 = world.add(new Tank(ORIGIN));

      expect(world.ofType(Tank)).toEqual([tank, heavy, tank2]);
      expect(world.ofType(HeavyTank)).toEqual([heavy]);
    });

    it('ofType(Entity) and all() return every entity in insertion order', () => {
      const { world } = createWorld();
      const a = world.add(new Crate(ORIGIN));
      const b = world.add(new Tank(ORIGIN));
      expect(world.ofType(Entity)).toEqual([a, b]);
      expect(world.all()).toEqual([a, b]);
    });
  });

  describe('removing', () => {
    it('removal is deferred until applyRemovals at the end of the tick', () => {
      const { world } = createWorld();
      const tank = world.add(new Tank(ORIGIN));

      world.remove(tank.id);
      expect(world.get(tank.id)).toBe(tank);
      expect(world.ofType(Tank)).toEqual([tank]);

      world.applyRemovals();
      expect(world.get(tank.id)).toBeUndefined();
      expect(world.ofType(Tank)).toEqual([]);
    });

    it('queues EntityDestroyed in removal order when removals are applied', () => {
      const { world, events, log } = createWorld();
      world.add(new Crate(ORIGIN));
      world.add(new Crate(ORIGIN));
      world.add(new Crate(ORIGIN));
      events.flush();
      log.length = 0;

      world.remove(3);
      world.remove(1);
      world.remove(3);
      world.applyRemovals();
      events.flush();

      expect(log).toEqual(['destroyed 3', 'destroyed 1']);
    });

    it('removing an unknown id is a no-op', () => {
      const { world, events, log } = createWorld();
      world.add(new Crate(ORIGIN));
      events.flush();
      log.length = 0;

      world.remove(42);
      world.applyRemovals();
      events.flush();

      expect(world.all()).toHaveLength(1);
      expect(log).toEqual([]);
    });

    it('ids are never reused after removal', () => {
      const { world } = createWorld();
      const first = world.add(new Crate(ORIGIN));
      world.remove(first.id);
      world.applyRemovals();
      expect(world.add(new Crate(ORIGIN)).id).toBe(2);
    });
  });
});
