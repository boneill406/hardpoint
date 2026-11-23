import { describe, expect, it } from 'vitest';
import type { GateDef } from '../../../src/sim/arena/ArenaDef';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_AI } from '../../../src/sim/defs/ai';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { INSURGENT_TANK, PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { AiController, type AiState } from '../../../src/sim/vehicles/controllers/AiController';
import { IDLE_COMMAND } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M4-4b against real Rapier on the slice arena: insurgents from the gates hunt
// a player sitting still at the start.

function gate(name: string): GateDef {
  const found = SLICE_ARENA.gates.find((g) => g.name === name);
  if (found === undefined) throw new Error(`no gate ${name}`);
  return found;
}

/** 2.5 u inside the gate, facing in (as the debug scene spawns them). */
function inside(g: GateDef): { position: Vec2; heading: number } {
  return { position: g.position.add(Vec2.fromHeading(g.heading).scale(2.5)), heading: g.heading };
}

interface Hunt {
  readonly simulation: Simulation;
  readonly ais: AiController[];
  readonly hits: SimEvents['Hit'][];
  readonly states: AiState[][];
}

async function hunt(
  gates: string[],
  duration: number,
  playerHealth = PLAYER_TANK.health,
): Promise<Hunt> {
  const ais = gates.map(() => new AiController(INSURGENT_AI));
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena: SLICE_ARENA,
    populate: (sim) => {
      sim.world.add(
        createVehicle(
          { ...PLAYER_TANK, health: playerHealth },
          {
            transform: SLICE_ARENA.playerStart,
            faction: 'player',
            controller: new ScriptedController(() => IDLE_COMMAND),
          },
        ),
      );
      gates.forEach((name, i) => {
        const ai = ais[i];
        if (ai === undefined) return;
        sim.world.add(
          createVehicle(INSURGENT_TANK, {
            transform: inside(gate(name)),
            faction: 'insurgent',
            controller: ai,
          }),
        );
      });
    },
  });
  const hits: SimEvents['Hit'][] = [];
  const states: AiState[][] = ais.map(() => []);
  simulation.events.on('Hit', (hit) => hits.push(hit));
  for (let i = 0; i < seconds(duration); i++) {
    simulation.tick(new Map());
    simulation.events.flush();
    ais.forEach((ai, k) => {
      const log = states[k];
      if (log !== undefined && log.at(-1) !== ai.debug.state) log.push(ai.debug.state);
    });
  }
  return { simulation, ais, hits, states };
}

describe('hunting (real Rapier, slice arena)', () => {
  it('an insurgent from the top gate gets round the centre pillar, engages and hits a still player', async () => {
    const { hits, states, simulation } = await hunt(['top'], 15);
    expect(states[0]?.slice(0, 2)).toEqual(['advance', 'engage']);
    const onPlayer = hits.filter(
      (hit) => hit.target === 1 + SLICE_ARENA.pillars.length + SLICE_ARENA.crates.length,
    );
    expect(onPlayer.length).toBeGreaterThanOrEqual(2);
    simulation.dispose();
  });

  it('three insurgents from three gates each end up engaging, at spots apart from each other', async () => {
    // A very tough player, or three insurgents destroy it in under 20 s and go idle.
    const { ais, simulation } = await hunt(['top', 'left', 'right'], 20, 10_000);
    expect(ais.map((ai) => ai.debug.state)).toEqual(['engage', 'engage', 'engage']);
    const spots = ais.map((ai) => ai.debug.spot);
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        const pa = spots[a];
        const pb = spots[b];
        if (pa === undefined || pb === undefined) throw new Error('missing spot');
        expect(pa.distanceTo(pb)).toBeGreaterThan(2);
      }
    }
    simulation.dispose();
  });

  it('the same seed gives the same hunt, tick for tick', async () => {
    const first = await hunt(['top', 'left'], 10);
    const second = await hunt(['top', 'left'], 10);
    expect(second.simulation.snapshot()).toEqual(first.simulation.snapshot());
    expect(second.hits).toEqual(first.hits);
    first.simulation.dispose();
    second.simulation.dispose();
  });
});
