import { describe, expect, it } from 'vitest';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';

const DT = 1 / 60;

// M0 only proves Rapier loads and steps in Node. Collision behavior tests arrive
// with bodies and queries in M2-3.
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
});
