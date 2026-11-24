import { describe, expect, it } from 'vitest';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { IDLE_COMMAND } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';
import { SLICE_WAVES } from '../../../src/sim/defs/waves';
import { WaveSurvivalMode } from '../../../src/sim/modes/WaveSurvivalMode';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { seconds } from '../physics/overlap';

// M5-1 against real Rapier on the slice arena. The player is made unkillable;
// tests destroy enemies by removing them, the same path a fatal hit takes.

const BANNER = seconds(SLICE_WAVES.timing.banner);

interface Spawn {
  readonly tick: number;
  readonly id: number;
  readonly position: Vec2;
  readonly heading: number;
}

class Run {
  readonly spawns: Spawn[] = [];
  readonly log: string[] = [];
  readonly ended: SimEvents['RunEnded'][] = [];
  readonly warnings: { tick: number; gate: string; count: number }[] = [];
  tick = 0;

  constructor(
    readonly simulation: Simulation,
    readonly mode: WaveSurvivalMode,
  ) {
    const { events } = simulation;
    events.on('EntitySpawned', ({ id }) => {
      const entity = simulation.world.get(id);
      if (entity instanceof Vehicle && entity.faction === 'insurgent') {
        const { position, heading } = entity.transform;
        this.spawns.push({ tick: this.tick, id, position, heading });
      }
    });
    events.on('WaveStarted', ({ wave }) => this.log.push(`${this.tick} start ${wave}`));
    events.on('GateWarning', ({ gate, count }) =>
      this.warnings.push({ tick: this.tick, gate, count }),
    );
    events.on('WaveCleared', ({ wave }) => this.log.push(`${this.tick} cleared ${wave}`));
    events.on('RunEnded', (ended) => {
      this.ended.push(ended);
      this.log.push(`${this.tick} ended ${ended.outcome}`);
    });
  }

  /** Runs `ticks` ticks, delivering events after each; `each` runs before every tick. */
  step(ticks: number, each?: () => void): void {
    for (let i = 0; i < ticks; i++) {
      each?.();
      this.simulation.tick(new Map());
      this.tick++;
      this.simulation.events.flush();
    }
  }

  enemies(): Vehicle[] {
    return this.simulation.world.ofType(Vehicle).filter((v) => v.faction === 'insurgent');
  }

  /** Destroys every enemy now on the field (removed at the end of the next tick). */
  killEnemies(): void {
    for (const enemy of this.enemies()) {
      this.simulation.world.remove(enemy.id);
    }
  }

  spawnsAfter(tick: number): Spawn[] {
    return this.spawns.filter((spawn) => spawn.tick > tick);
  }
}

async function startRun(options: { seed?: number; startWave?: number } = {}): Promise<Run> {
  const mode = new WaveSurvivalMode(
    { ...SLICE_WAVES, player: { ...PLAYER_TANK, health: 1e9 } },
    { playerId: 1, ...(options.startWave === undefined ? {} : { startWave: options.startWave }) },
  );
  const simulation = new Simulation({
    seed: options.seed ?? 1,
    physics: await RapierPhysicsWorld.create(),
    arena: SLICE_ARENA,
    mode,
  });
  const run = new Run(simulation, mode);
  simulation.events.flush();
  return run;
}

function gateOf(spawn: Spawn): string {
  const gate = SLICE_ARENA.gates.find(
    (g) => Math.abs(g.heading - spawn.heading) < 1e-9 && spawn.position.distanceTo(g.position) < 4,
  );
  return gate?.name ?? 'none';
}

describe('WaveSurvivalMode: a wave', () => {
  it('starts with the player at the start and the wave 1 banner; the tank emerges when the banner ends', async () => {
    const run = await startRun();
    const player = run.simulation.world.ofType(Vehicle).find((v) => v.faction === 'player');
    expect(player?.transform.position).toEqual(SLICE_ARENA.playerStart.position);
    expect(run.mode.status).toMatchObject({ phase: 'banner', wave: 1, waves: 5, enemiesLeft: 1 });
    run.step(BANNER - 1);
    expect(run.spawns).toEqual([]);
    run.step(1);
    expect(run.spawns).toHaveLength(1);
    expect(run.mode.status.phase).toBe('fighting');
    run.simulation.dispose();
  });

  it('a lone tank appears 2.5 u inside a gate, centred, facing into the arena', async () => {
    const run = await startRun();
    run.step(BANNER);
    const [spawn] = run.spawns;
    const gate = SLICE_ARENA.gates.find((g) => g.name === (spawn && gateOf(spawn)));
    if (spawn === undefined || gate === undefined) throw new Error('no spawn at a gate');
    expect(spawn.position.distanceTo(gate.position)).toBeCloseTo(SLICE_WAVES.slots.inset, 9);
    expect(spawn.heading).toBe(gate.heading);
    run.simulation.dispose();
  });

  it('is cleared only when every enemy it spawned is gone; unspawned tanks count as left', async () => {
    const run = await startRun({ startWave: 2 });
    expect(run.mode.status.enemiesLeft).toBe(2);
    run.step(BANNER + 1);
    run.killEnemies();
    run.step(1);
    // The first is gone, the second (at 4 s) hasn't come yet: not cleared.
    expect(run.mode.status).toMatchObject({ phase: 'fighting', enemiesLeft: 1 });
    run.step(seconds(4));
    expect(run.spawns).toHaveLength(2);
    expect(run.log.some((line) => line.includes('cleared'))).toBe(false);
    run.killEnemies();
    run.step(1);
    expect(run.log.at(-1)).toMatch(/cleared 2$/);
    expect(run.mode.status.phase).toBe('cleared');
    run.simulation.dispose();
  });

  it('after "cleared" (1.5 s) and the breather (5 s) the next wave starts', async () => {
    const run = await startRun();
    run.step(BANNER + 1);
    run.killEnemies();
    run.step(1);
    const clearedAt = run.tick;
    run.step(seconds(1.5));
    expect(run.mode.status).toMatchObject({ phase: 'breather', secondsLeft: 5 });
    run.step(seconds(5));
    expect(run.log).toContain(`${clearedAt + seconds(6.5)} start 2`);
    expect(run.mode.status).toMatchObject({ phase: 'banner', wave: 2, enemiesLeft: 2 });
    run.simulation.dispose();
  });
});

describe('WaveSurvivalMode: spawn groups and gates', () => {
  it('a one-gate pair comes out side by side at one gate, 2.4 u apart, both facing in', async () => {
    const run = await startRun({ startWave: 3 });
    run.step(BANNER);
    const [a, b] = run.spawns;
    if (a === undefined || b === undefined) throw new Error('pair not spawned');
    expect(gateOf(a)).toBe(gateOf(b));
    expect(a.position.distanceTo(b.position)).toBeCloseTo(SLICE_WAVES.slots.spacing, 9);
    expect(a.heading).toBe(b.heading);
    run.simulation.dispose();
  });

  it('a spread group of three uses all three gates at once', async () => {
    const run = await startRun({ startWave: 4 });
    run.step(BANNER);
    expect(new Set(run.spawns.map(gateOf))).toEqual(new Set(['left', 'right', 'top']));
    run.simulation.dispose();
  });

  it("a later group comes from a gate the wave hasn't used yet", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = await startRun({ seed, startWave: 2 });
      run.step(BANNER + seconds(4));
      const [first, second] = run.spawns;
      if (first === undefined || second === undefined) throw new Error('missing spawns');
      expect(gateOf(second)).not.toBe(gateOf(first));
      run.simulation.dispose();
    }
  });

  it('gates come from the seed: the same seed repeats them, different seeds vary', async () => {
    const firstGate = async (seed: number): Promise<string> => {
      const run = await startRun({ seed });
      run.step(BANNER);
      const spawn = run.spawns[0];
      run.simulation.dispose();
      return spawn === undefined ? 'none' : gateOf(spawn);
    };
    expect(await firstGate(7)).toBe(await firstGate(7));
    const gates = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      gates.add(await firstGate(seed));
    }
    expect(gates.size).toBeGreaterThan(1);
  });
});

describe('WaveSurvivalMode: the end of a run', () => {
  it('the player being destroyed ends the run in defeat, and nothing spawns after', async () => {
    const run = await startRun();
    const player = run.simulation.world.ofType(Vehicle).find((v) => v.faction === 'player');
    if (player === undefined) throw new Error('no player');
    run.step(30);
    run.simulation.world.remove(player.id);
    run.step(1);
    expect(run.ended).toEqual([{ outcome: 'defeat', wave: 1 }]);
    expect(run.mode.outcome).toBe('defeat');
    run.step(seconds(10));
    expect(run.spawns).toEqual([]);
    expect(run.ended).toHaveLength(1);
    run.simulation.dispose();
  });

  it('clearing the last wave wins at once (no breather)', async () => {
    const run = await startRun({ startWave: 5 });
    run.step(BANNER + seconds(8), () => run.killEnemies());
    expect(run.ended).toEqual([{ outcome: 'victory', wave: 5 }]);
    expect(run.mode.status.phase).toBe('victory');
    run.simulation.dispose();
  });

  it('a whole run, every enemy destroyed as it arrives: five waves of 1–5 tanks, then victory', async () => {
    const run = await startRun();
    run.step(seconds(90), () => run.killEnemies());
    expect(run.ended).toEqual([{ outcome: 'victory', wave: 5 }]);
    const starts = run.log
      .filter((line) => line.includes('start'))
      .map((l) => Number(l.split(' ')[0]));
    const perWave = starts.map(
      (from, i) =>
        run.spawns.filter((s) => s.tick >= from && s.tick < (starts[i + 1] ?? Infinity)).length,
    );
    expect(perWave).toEqual([1, 2, 3, 4, 5]);
    run.simulation.dispose();
  });

  it('the same seed gives the same run, event for event', async () => {
    const play = async (): Promise<string[]> => {
      const run = await startRun({ seed: 3 });
      run.step(seconds(60), () => {
        if (run.tick % 90 === 0) run.killEnemies();
      });
      run.simulation.dispose();
      const spawns = run.spawns.map((s) => `${s.tick} ${s.position.x},${s.position.z}`);
      return [...run.log, ...spawns];
    };
    expect(await play()).toEqual(await play());
  });

  it('rejects a start wave outside 1–5', () => {
    expect(() => new WaveSurvivalMode(SLICE_WAVES, { playerId: 1, startWave: 0 })).toThrow();
    expect(() => new WaveSurvivalMode(SLICE_WAVES, { playerId: 1, startWave: 6 })).toThrow();
  });
});

/** Where a lone tank comes out of `name`: 2.5 u inside, centred. */
function gateSpot(name: string): Vec2 {
  const gate = SLICE_ARENA.gates.find((g) => g.name === name);
  if (gate === undefined) throw new Error(`no gate ${name}`);
  return gate.position.add(Vec2.fromHeading(gate.heading).scale(SLICE_WAVES.slots.inset));
}

/** Parks an idle player-side tank on a gate's spawn spot (the player counts as a blocker too). */
function block(run: Run, name: string): number {
  return run.simulation.world.add(
    createVehicle(PLAYER_TANK, {
      transform: { position: gateSpot(name), heading: 0 },
      faction: 'player',
      controller: new ScriptedController(() => IDLE_COMMAND),
    }),
  ).id;
}

const WARNING = seconds(SLICE_WAVES.timing.warning);

describe('WaveSurvivalMode: gate warnings and blocked gates (M5-2)', () => {
  it("a group's gate glows 1 s before its tanks come out of that gate", async () => {
    const run = await startRun();
    run.step(BANNER);
    const [warning] = run.warnings;
    const [spawn] = run.spawns;
    if (warning === undefined || spawn === undefined) throw new Error('no warning or spawn');
    expect(warning).toMatchObject({ tick: BANNER - WARNING, count: 1 });
    expect(spawn.tick).toBe(BANNER);
    expect(gateOf(spawn)).toBe(warning.gate);
    run.simulation.dispose();
  });

  it('a spread group warns all three gates together; a pair warns its one gate with count 2', async () => {
    const spread = await startRun({ startWave: 4 });
    spread.step(BANNER);
    const first = spread.warnings.filter((w) => w.tick === BANNER - WARNING);
    expect(new Set(first.map((w) => w.gate))).toEqual(new Set(['left', 'right', 'top']));
    spread.simulation.dispose();
    const pair = await startRun({ startWave: 3 });
    pair.step(BANNER);
    expect(pair.warnings[0]).toMatchObject({ count: 2 });
    pair.simulation.dispose();
  });

  it('a gate blocked when its tanks are due: they warn at another free gate and come out 1 s later', async () => {
    const run = await startRun();
    run.step(BANNER - WARNING + 1);
    const warned = run.warnings[0]?.gate ?? 'none';
    block(run, warned);
    run.step(WARNING);
    expect(run.spawns).toEqual([]);
    const rerouted = run.warnings[1];
    expect(rerouted?.gate).not.toBe(warned);
    run.step(WARNING);
    const [spawn] = run.spawns;
    expect(spawn === undefined ? 'none' : gateOf(spawn)).toBe(rerouted?.gate);
    run.simulation.dispose();
  });

  it('with every gate blocked it waits; once one clears it warns there and spawns after 1 s', async () => {
    const run = await startRun();
    const blockers = ['left', 'right', 'top'].map((name) => block(run, name));
    run.step(BANNER + seconds(3));
    expect(run.spawns).toEqual([]);
    expect(run.warnings).toEqual([]);
    expect(run.mode.status.enemiesLeft).toBe(1);
    const top = blockers[2];
    if (top === undefined) throw new Error('setup');
    run.simulation.world.remove(top);
    run.step(2);
    expect(run.warnings.map((w) => w.gate)).toEqual(['top']);
    run.step(WARNING);
    expect(run.spawns.map(gateOf)).toEqual(['top']);
    run.simulation.dispose();
  });
});
