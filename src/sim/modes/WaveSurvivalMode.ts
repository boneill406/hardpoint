import type { EntityId } from '../core/Entity';
import { secondsToTicks, TICK_RATE } from '../core/time';
import { PlayerController } from '../vehicles/controllers/PlayerController';
import { Vehicle } from '../vehicles/Vehicle';
import type { PlayerId } from '../vehicles/VehicleCommand';
import { createVehicle } from '../vehicles/VehicleFactory';
import { GateSpawner } from './GateSpawner';
import type { GameMode, ModeContext, RunOutcome } from './GameMode';
import type { WaveDef, WaveSurvivalDef } from './WaveDef';

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
  /** Enemies spawned this wave; dead ones are dropped as they leave the world. */
  private readonly enemies = new Set<EntityId>();
  private readonly spawner: GateSpawner;
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
    this.spawner = new GateSpawner(def);
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
          this.startBreather(context);
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
    this.spawner.beginWave(this.wave.groups, this.ticks.banner);
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
    for (const id of this.spawner.update(context, this.phaseTicks)) {
      this.enemies.add(id);
    }
    for (const id of [...this.enemies]) {
      if (context.world.get(id) === undefined) {
        this.enemies.delete(id);
      }
    }
    if (this.phase === 'fighting' && this.spawner.remaining === 0 && this.enemies.size === 0) {
      context.events.emit('WaveCleared', { wave: this.waveIndex + 1 });
      if (this.waveIndex === this.def.waves.length - 1) {
        this.end(context, 'victory');
      } else {
        this.enter('cleared');
      }
    }
  }

  /** "WAVE CLEARED" is over: repair the player by the wave's `repair` and start the countdown (M5 plan D6). */
  private startBreather(context: ModeContext): void {
    this.enter('breather');
    const player =
      this.playerVehicle === undefined ? undefined : context.world.get(this.playerVehicle);
    if (!(player instanceof Vehicle)) {
      return;
    }
    const repaired = player.health.repair(this.wave.repair * player.health.max);
    context.events.emit('BreatherStarted', {
      wave: this.waveIndex + 1,
      seconds: this.def.timing.breather,
      repaired,
      healthNow: player.health.current,
    });
  }

  private enter(phase: WavePhase): void {
    this.phase = phase;
    this.phaseTicks = 0;
  }

  private end(context: ModeContext, outcome: RunOutcome): void {
    this.ended = outcome;
    this.enter(outcome);
    this.spawner.cancel();
    context.events.emit('RunEnded', { outcome, wave: this.waveIndex + 1 });
  }

  private enemiesLeft(): number {
    if (this.phase !== 'banner' && this.phase !== 'fighting') {
      return 0;
    }
    return this.spawner.remaining + this.enemies.size;
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
