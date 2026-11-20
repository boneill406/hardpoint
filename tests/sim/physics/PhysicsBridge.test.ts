import { describe, expect, it } from 'vitest';
import { Prop } from '../../../src/sim/arena/Prop';
import { Entity } from '../../../src/sim/core/Entity';
import { EventBus } from '../../../src/sim/core/EventBus';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { World } from '../../../src/sim/core/World';
import { PhysicsBridge } from '../../../src/sim/physics/PhysicsBridge';
import { drive, scriptedTank } from '../vehicles/testVehicles';
import { FakePhysicsWorld } from './FakePhysicsWorld';

class Marker extends Entity {}

function setup(): { world: World; physics: FakePhysicsWorld; bridge: PhysicsBridge } {
  const physics = new FakePhysicsWorld();
  return {
    world: new World(new EventBus<SimEvents>()),
    physics,
    bridge: new PhysicsBridge(physics),
  };
}

const crate = (): Prop =>
  new Prop({ position: new Vec2(2, 3), heading: 0 }, 'crate', { width: 1.5, depth: 1.5 }, true);

describe('PhysicsBridge', () => {
  it('creates one body per vehicle and prop, once, and none for other entities', () => {
    const { world, physics, bridge } = setup();
    world.add(scriptedTank(drive(0)));
    world.add(crate());
    world.add(new Marker({ position: Vec2.ZERO, heading: 0 }));

    bridge.sync(world);
    bridge.sync(world);

    expect(bridge.size).toBe(2);
    expect(physics.vehicleCount).toBe(1);
    expect(physics.staticBoxes).toEqual([
      { center: new Vec2(2, 3), width: 1.5, depth: 1.5, heading: 0 },
    ]);
  });

  it('removes the body when its entity leaves the world', () => {
    const { world, physics, bridge } = setup();
    const box = world.add(crate());
    bridge.sync(world);

    world.remove(box.id);
    world.applyRemovals();
    bridge.sync(world);

    expect(bridge.size).toBe(0);
    expect(physics.removed).toHaveLength(1);
  });

  it('pushes vehicle velocities to physics and pulls the moved transform back', () => {
    const { world, physics, bridge } = setup();
    const tank = world.add(scriptedTank(drive(1)));
    tank.applyCommand(drive(1));
    tank.drive(1 / 60);
    bridge.sync(world);

    bridge.pushVelocities([tank]);
    physics.step(1);
    bridge.pullState([tank]);

    expect(tank.transform.position.z).toBeCloseTo(tank.linearVelocity.z, 12);
    expect(tank.transform.position.z).toBeGreaterThan(0);
  });

  it('refuses to push a vehicle that has no body yet', () => {
    const { world, bridge } = setup();
    const tank = world.add(scriptedTank(drive(1)));
    expect(() => bridge.pushVelocities([tank])).toThrow('call sync first');
  });
});
