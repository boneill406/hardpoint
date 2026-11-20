import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';

const DT = 1 / 60;

// Loading, stepping and the sim ↔ Rapier conventions. Collision behaviour is
// tested through the Simulation in collision.test.ts.
describe('RapierPhysicsWorld', () => {
  it('loads the WASM module and creates a world', async () => {
    const world = await RapierPhysicsWorld.create();
    expect(world).toBeInstanceOf(RapierPhysicsWorld);
    world.dispose();
  });

  it('creates independent worlds after the module has loaded once', async () => {
    const [a, b] = await Promise.all([RapierPhysicsWorld.create(), RapierPhysicsWorld.create()]);
    expect(a).not.toBe(b);
    a.dispose();
    b.dispose();
  });

  it('steps an empty world at the fixed 60 Hz timestep', async () => {
    const world = await RapierPhysicsWorld.create();
    expect(() => {
      for (let tick = 0; tick < 60; tick++) {
        world.step(DT);
      }
    }).not.toThrow();
    world.dispose();
  });

  describe('sim conventions (heading 0 = +z, positive = clockwise)', () => {
    const TANK = { length: 2.4, width: 1.6, mass: 30 };

    it('reads back the position and heading a body was created with', async () => {
      const world = await RapierPhysicsWorld.create();
      const handle = world.addVehicleBody({
        ...TANK,
        transform: { position: new Vec2(3, -4), heading: 1 },
      });
      const { transform } = world.readBody(handle);
      expect(transform.position.x).toBeCloseTo(3, 5);
      expect(transform.position.z).toBeCloseTo(-4, 5);
      expect(transform.heading).toBeCloseTo(1, 5);
      world.dispose();
    });

    it('moves a body along its velocity: +z velocity increases z', async () => {
      const world = await RapierPhysicsWorld.create();
      const handle = world.addVehicleBody({
        ...TANK,
        transform: { position: Vec2.ZERO, heading: 0 },
      });
      for (let tick = 0; tick < 60; tick++) {
        world.setVelocity(handle, new Vec2(0, 5), 0);
        world.step(DT);
      }
      expect(world.readBody(handle).transform.position.z).toBeCloseTo(5, 3);
      world.dispose();
    });

    it('positive angular velocity turns clockwise (heading increases) and reads back positive', async () => {
      const world = await RapierPhysicsWorld.create();
      const handle = world.addVehicleBody({
        ...TANK,
        transform: { position: Vec2.ZERO, heading: 0 },
      });
      for (let tick = 0; tick < 30; tick++) {
        world.setVelocity(handle, Vec2.ZERO, 1);
        world.step(DT);
      }
      const state = world.readBody(handle);
      expect(state.transform.heading).toBeCloseTo(0.5, 3);
      expect(state.angularVelocity).toBeCloseTo(1, 3);
      world.dispose();
    });

    it('a removed static box no longer blocks', async () => {
      const world = await RapierPhysicsWorld.create();
      const wall = world.addStaticBox({ center: new Vec2(0, 3), width: 4, depth: 1, heading: 0 });
      world.removeBody(wall);
      const handle = world.addVehicleBody({
        ...TANK,
        transform: { position: Vec2.ZERO, heading: 0 },
      });
      for (let tick = 0; tick < 60; tick++) {
        world.setVelocity(handle, new Vec2(0, 6), 0);
        world.step(DT);
      }
      expect(world.readBody(handle).transform.position.z).toBeGreaterThan(5);
      world.dispose();
    });

    it('reading a removed body throws instead of returning garbage', async () => {
      const world = await RapierPhysicsWorld.create();
      const handle = world.addVehicleBody({
        ...TANK,
        transform: { position: Vec2.ZERO, heading: 0 },
      });
      world.removeBody(handle);
      expect(() => world.readBody(handle)).toThrow('No physics body');
      world.dispose();
    });
  });
});
