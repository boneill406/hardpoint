import { describe, expect, it } from 'vitest';
import { Pathfinder } from '../../../src/sim/ai/Pathfinder';
import { Simulation } from '../../../src/sim/core/Simulation';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { IDLE_COMMAND } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M4-2 on the slice arena, with real props: the grid matches the layout, every
// gate and the player start are reachable, and a broken crate's cells reopen.

async function slice(command = IDLE_COMMAND): Promise<Simulation> {
  return new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: SLICE_ARENA,
    populate: (sim) => {
      sim.world.add(
        createVehicle(PLAYER_TANK, {
          transform: SLICE_ARENA.playerStart,
          faction: 'player',
          controller: new ScriptedController(() => command),
        }),
      );
    },
  });
}

describe('navigation grid in the slice arena', () => {
  it('blocks walls and cover, and leaves the player start open', async () => {
    const simulation = await slice();
    const grid = simulation.navGrid;
    expect(grid).toBeDefined();
    if (grid === undefined) return;
    expect(grid.isOpenAt(SLICE_ARENA.playerStart.position)).toBe(true);
    expect(grid.isOpenAt(new Vec2(0, 2))).toBe(false); // centre pillar
    expect(grid.isOpenAt(new Vec2(0, -5))).toBe(false); // a crate
    expect(grid.isOpenAt(new Vec2(22.8, 0))).toBe(false); // against the right wall
    simulation.dispose();
  });

  it('every gate can reach the player start', async () => {
    const simulation = await slice();
    const grid = simulation.navGrid;
    if (grid === undefined) throw new Error('no grid');
    const pathfinder = new Pathfinder();
    for (const gate of SLICE_ARENA.gates) {
      const path = pathfinder.findPath(grid, gate.position, SLICE_ARENA.playerStart.position);
      expect(path, gate.name).toBeDefined();
    }
    simulation.dispose();
  });

  it('a crate broken by the cannon reopens its cells at the end of that tick', async () => {
    // The first thing on the player's line of fire (x = 0) is the crate at (0, −5).
    const simulation = await slice({ ...IDLE_COMMAND, firePrimary: true });
    const before = simulation.navGrid;
    expect(before?.isOpenAt(new Vec2(0, -5))).toBe(false);
    for (let i = 0; i < seconds(0.5); i++) {
      simulation.tick(new Map());
    }
    expect(simulation.navGrid).not.toBe(before);
    expect(simulation.navGrid?.isOpenAt(new Vec2(0, -5))).toBe(true);
    // The old grid is an unchanged snapshot.
    expect(before?.isOpenAt(new Vec2(0, -5))).toBe(false);
    simulation.dispose();
  });
});
