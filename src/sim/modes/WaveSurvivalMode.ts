import type { GateDef } from '../arena/ArenaDef';
import type { EntityId } from '../core/Entity';
import { secondsToTicks, TICK_RATE } from '../core/time';
import type { Transform } from '../core/Transform';
import { Vec2 } from '../core/Vec2';
import { AiController } from '../vehicles/controllers/AiController';
import { PlayerController } from '../vehicles/controllers/PlayerController';
import type { PlayerId } from '../vehicles/VehicleCommand';
import { createVehicle } from '../vehicles/VehicleFactory';
import type { GameMode, ModeContext, RunOutcome } from './GameMode';
import type { SpawnGroupDef, WaveDef, WaveSurvivalDef } from './WaveDef';

/**
 * Where a run is (M5 plan): the banner before a wave, fighting it, the
 * "WAVE CLEARED" beat, the breather between waves, or the end.
 */
export type WavePhase = 'banner' | 'fighting' | 'cleared' | 'breather' | 'victory' | 'defeat';

/** What the HUD shows (M5-6a). Plain numbers, read-only. */
export interface WaveStatus {
  readonly phase: WavePhase;
  /** 1-based. */
  readonly wave: number;
  readonly waves: number;
  /** Alive plus not yet spawned, this wave. */
  readonly enemiesLeft: number;
  /** Time left in a timed phase (banner, cleared, breather), else 0. */
  readonly secondsLeft: number;
}

export interface WaveSurvivalOptions {
  /** Whose input drives the player's tank. */
  readonly playerId: PlayerId;
  /** 1-based wave to start at (`?wave=N`, for testing); default 1. */
  readonly startWave?: number;
}

interface PendingGroup {
  readonly def: SpawnGroupDef;
  /** Ticks after the wave started at which its tanks emerge. */
  readonly dueTick: number;
}

/**
 * The slice's game mode (GDD §2): survive five waves of insurgents. Each wave
 * is a list of timed spawn groups (M5 plan D2); the wave is cleared when every
 * enemy it spawned has been destroyed, by anyone. The player losing all armor
 * ends the run at once, in any phase.
 *
 * Time is counted in ticks and gates are picked with the simulation's `Rng`,
 * so the same seed and inputs give the same run.
 */
export class WaveSurvivalMode implements GameMode {
  private phase: WavePhase = 'banner';
  private waveIndex: number;
  /** Ticks since the current phase began (wave phases count from the wave's start). */
  private phaseTicks = 0;
  private pending: PendingGroup[] = [];
  /** Enemies spawned this wave; dead ones are dropped as they leave the world. */
  private readonly enemies = new Set<EntityId>();
  /** Gates used so far this wave, so later groups prefer the others. */
  private readonly usedGates = new Set<string>();
  private playerVehicle: EntityId | undefined;
  private ended: RunOutcome | undefined;
  private readonly ticks: {
    readonly banner: number;
    readonly cleared: number;
    readonly breather: number;
  };

  constructor(
    private readonly def: WaveSurvivalDef,
    private readonly options: WaveSurvivalOptions,
  ) {
    if (def.waves.length === 0) {
      throw new RangeError('A wave-survival run needs at least one wave');
    }
    const start = options.startWave ?? 1;
    if (!Number.isInteger(start) || start < 1 || start > def.waves.length) {
      throw new RangeError(`startWave must be 1–${def.waves.length}, got ${start}`);
    }
    this.waveIndex = start - 1;
    this.ticks = {
      banner: secondsToTicks(def.timing.banner),
      cleared: secondsToTicks(def.timing.cleared),
      breather: secondsToTicks(def.timing.breather),
    };
  }

  get outcome(): RunOutcome | undefined {
    return this.ended;
  }

  /** The player's tank id (undefined before `start`). */
  get playerId(): EntityId | undefined {
    return this.playerVehicle;
  }

  get status(): WaveStatus {
    return {
      phase: this.phase,
      wave: this.waveIndex + 1,
      waves: this.def.waves.length,
      enemiesLeft: this.enemiesLeft(),
      secondsLeft: this.secondsLeft(),
    };
  }

  start(context: ModeContext): void {
    const player = context.world.add(
      createVehicle(this.def.player, {
        transform: context.arena.def.playerStart,
        faction: 'player',
        controller: new PlayerController(this.options.playerId),
      }),
    );
    this.playerVehicle = player.id;
    this.beginWave(context);
  }

  update(context: ModeContext): void {
    if (this.ended !== undefined) {
      return;
    }
    if (this.playerVehicle === undefined || context.world.get(this.playerVehicle) === undefined) {
      this.end(context, 'defeat');
      return;
    }
    this.phaseTicks++;
    switch (this.phase) {
      case 'banner':
      case 'fighting':
        this.updateWave(context);
        break;
      case 'cleared':
        if (this.phaseTicks >= this.ticks.cleared) {
          this.enter('breather');
        }
        break;
      case 'breather':
        if (this.phaseTicks >= this.ticks.breather) {
          this.waveIndex++;
          this.beginWave(context);
        }
        break;
      case 'victory':
      case 'defeat':
        break;
    }
  }

  private get wave(): WaveDef {
    const wave = this.def.waves[this.waveIndex];
    if (wave === undefined) {
      throw new Error(`No wave ${this.waveIndex + 1}`);
    }
    return wave;
  }

  private beginWave(context: ModeContext): void {
    this.enter('banner');
    this.enemies.clear();
    this.usedGates.clear();
    this.pending = this.wave.groups.map((group) => ({
      def: group,
      dueTick: this.ticks.banner + secondsToTicks(group.at),
    }));
    context.events.emit('WaveStarted', {
      wave: this.waveIndex + 1,
      waves: this.def.waves.length,
      enemies: this.wave.groups.reduce((sum, group) => sum + group.count, 0),
    });
  }

  /** Banner and fighting: spawn what is due, drop the dead, check for a clear. */
  private updateWave(context: ModeContext): void {
    if (this.phase === 'banner' && this.phaseTicks >= this.ticks.banner) {
      this.phase = 'fighting';
    }
    const due = this.pending.filter((group) => group.dueTick <= this.phaseTicks);
    this.pending = this.pending.filter((group) => group.dueTick > this.phaseTicks);
    for (const group of due) {
      this.spawnGroup(context, group.def);
    }
    for (const id of [...this.enemies]) {
      if (context.world.get(id) === undefined) {
        this.enemies.delete(id);
      }
    }
    if (this.phase === 'fighting' && this.pending.length === 0 && this.enemies.size === 0) {
      context.events.emit('WaveCleared', { wave: this.waveIndex + 1 });
      if (this.waveIndex === this.def.waves.length - 1) {
        this.end(context, 'victory');
      } else {
        this.enter('cleared');
      }
    }
  }

  private spawnGroup(context: ModeContext, group: SpawnGroupDef): void {
    const spots =
      group.from === 'spread'
        ? this.pickGates(context, group.count).map((gate) => this.slot(gate, 0))
        : this.groupAtOneGate(context, group);
    for (const transform of spots) {
      const enemy = context.world.add(
        createVehicle(this.def.enemy.vehicle, {
          transform,
          faction: 'insurgent',
          controller: new AiController(this.def.enemy.ai),
        }),
      );
      this.enemies.add(enemy.id);
    }
  }

  /** Side by side in the gate's slots: the first in slot 0, the second in slot 1. */
  private groupAtOneGate(context: ModeContext, group: SpawnGroupDef): Transform[] {
    const named = context.arena.def.gates.find((gate) => gate.name === group.gate);
    const gate = named ?? this.pickGates(context, 1)[0];
    if (gate === undefined) {
      return [];
    }
    if (group.count === 1) {
      return [this.slot(gate, undefined)];
    }
    return Array.from({ length: group.count }, (_, i) => this.slot(gate, i));
  }

  /**
   * `count` different gates, picked at random, gates not yet used this wave
   * first (so "a second group" means "another gate" whenever one is left).
   */
  private pickGates(context: ModeContext, count: number): GateDef[] {
    const gates = context.arena.def.gates;
    const fresh = gates.filter((gate) => !this.usedGates.has(gate.name));
    const used = gates.filter((gate) => this.usedGates.has(gate.name));
    const picked = [...shuffle(fresh, context), ...shuffle(used, context)].slice(0, count);
    for (const gate of picked) {
      this.usedGates.add(gate.name);
    }
    return picked;
  }

  /**
   * Where a tank appears at `gate`, facing in: `inset` inside it, in slot 0 or
   * 1 (side by side, `spacing` apart), or centred when `slot` is undefined.
   */
  private slot(gate: GateDef, slot: number | undefined): Transform {
    const { inset, spacing } = this.def.slots;
    const inward = Vec2.fromHeading(gate.heading);
    const across = Vec2.fromHeading(gate.heading + Math.PI / 2);
    const offset = slot === undefined ? 0 : (slot === 0 ? -0.5 : 0.5) * spacing;
    return {
      position: gate.position.add(inward.scale(inset)).add(across.scale(offset)),
      heading: gate.heading,
    };
  }

  private enter(phase: WavePhase): void {
    this.phase = phase;
    this.phaseTicks = 0;
  }

  private end(context: ModeContext, outcome: RunOutcome): void {
    this.ended = outcome;
    this.enter(outcome);
    this.pending = [];
    context.events.emit('RunEnded', { outcome, wave: this.waveIndex + 1 });
  }

  private enemiesLeft(): number {
    if (this.phase !== 'banner' && this.phase !== 'fighting') {
      return 0;
    }
    const unspawned = this.pending.reduce((sum, group) => sum + group.def.count, 0);
    return unspawned + this.enemies.size;
  }

  private secondsLeft(): number {
    const length =
      this.phase === 'banner'
        ? this.ticks.banner
        : this.phase === 'cleared'
          ? this.ticks.cleared
          : this.phase === 'breather'
            ? this.ticks.breather
            : 0;
    return Math.max(0, length - this.phaseTicks) / TICK_RATE;
  }
}

/** Fisher–Yates with the sim's `Rng`: a deterministic shuffle (copy). */
function shuffle<T>(items: readonly T[], context: ModeContext): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = context.rng.int(0, i);
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
