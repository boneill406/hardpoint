import type { GateDef } from '../arena/ArenaDef';
import type { EntityId } from '../core/Entity';
import { secondsToTicks } from '../core/time';
import type { Transform } from '../core/Transform';
import { Vec2 } from '../core/Vec2';
import { AiController } from '../vehicles/controllers/AiController';
import { Vehicle } from '../vehicles/Vehicle';
import { createVehicle } from '../vehicles/VehicleFactory';
import type { ModeContext } from './GameMode';
import type { SpawnGroupDef, WaveSurvivalDef } from './WaveDef';

/**
 * Tanks that come out of one gate together: a `one-gate` group, or one tank of
 * a `spread` group. Lifecycle: scheduled → warned (gate glowing) → spawned, or
 * waiting while every gate is blocked.
 */
interface SpawnUnit {
  readonly count: number;
  readonly gateName: string | undefined;
  state: 'scheduled' | 'warned' | 'waiting';
  /** Scheduled: when to warn. Warned: when to emerge. (Ticks since the wave began.) */
  dueTick: number;
  gate: GateDef | undefined;
}

/**
 * Brings a wave's enemies in through the arena's gates (M5 plan D2–D4). Each
 * unit's gate glows for `warning` before its tanks emerge (`GateWarning`); a
 * gate is only used if its spawn spots are clear, otherwise the unit moves to
 * another free gate (warning again) or waits until one is free. Never puts a
 * tank on top of another.
 */
export class GateSpawner {
  private units: SpawnUnit[] = [];
  /** Gates used so far this wave, so later units prefer the others. */
  private readonly usedGates = new Set<string>();
  private readonly warningTicks: number;

  constructor(private readonly def: WaveSurvivalDef) {
    this.warningTicks = secondsToTicks(def.timing.warning);
  }

  /** Tanks this wave that haven't come out yet. */
  get remaining(): number {
    return this.units.reduce((sum, unit) => sum + unit.count, 0);
  }

  /**
   * Schedules a wave's groups: each emerges `at` after `startTick` (the end of
   * the banner), its gate warning `warning` before that.
   */
  beginWave(groups: readonly SpawnGroupDef[], startTick: number): void {
    this.usedGates.clear();
    this.units = groups.flatMap((group) => {
      const emerge = startTick + secondsToTicks(group.at);
      const dueTick = Math.max(0, emerge - this.warningTicks);
      const unit = (count: number): SpawnUnit => ({
        count,
        gateName: group.gate,
        state: 'scheduled',
        dueTick,
        gate: undefined,
      });
      return group.from === 'spread'
        ? Array.from({ length: group.count }, () => unit(1))
        : [unit(group.count)];
    });
  }

  /** Stops all pending spawns (the run ended). */
  cancel(): void {
    this.units = [];
  }

  /** Warns and spawns what is due at `waveTick`; returns the ids of tanks spawned. */
  update(context: ModeContext, waveTick: number): EntityId[] {
    const spawned: EntityId[] = [];
    for (const unit of [...this.units]) {
      if (unit.state === 'scheduled' && waveTick >= unit.dueTick) {
        this.announce(context, unit, waveTick);
      } else if (unit.state === 'waiting') {
        this.announce(context, unit, waveTick);
      } else if (unit.state === 'warned' && waveTick >= unit.dueTick) {
        const gate = unit.gate;
        if (gate !== undefined && this.isClear(context, gate, unit.count)) {
          spawned.push(...this.spawn(context, gate, unit.count));
          this.units = this.units.filter((other) => other !== unit);
        } else {
          this.announce(context, unit, waveTick);
        }
      }
    }
    return spawned;
  }

  /** Picks a free gate and starts its warning; with none free, waits. */
  private announce(context: ModeContext, unit: SpawnUnit, waveTick: number): void {
    const free = context.arena.def.gates.filter((gate) => this.isClear(context, gate, unit.count));
    const named = free.find((gate) => gate.name === unit.gateName);
    const gate = named ?? this.pickGate(context, free);
    if (gate === undefined) {
      unit.state = 'waiting';
      unit.gate = undefined;
      return;
    }
    this.usedGates.add(gate.name);
    unit.state = 'warned';
    unit.gate = gate;
    unit.dueTick = waveTick + this.warningTicks;
    context.events.emit('GateWarning', {
      gate: gate.name,
      count: unit.count,
      seconds: this.def.timing.warning,
    });
  }

  /** A random gate among `candidates`, ones unused this wave first. */
  private pickGate(context: ModeContext, candidates: readonly GateDef[]): GateDef | undefined {
    const fresh = candidates.filter((gate) => !this.usedGates.has(gate.name));
    const pool = fresh.length > 0 ? fresh : candidates;
    return pool.length === 0 ? undefined : context.rng.pick(pool);
  }

  /** True if nothing (no tank, including the player) is within `clearance` of the spots `count` tanks need. */
  private isClear(context: ModeContext, gate: GateDef, count: number): boolean {
    const vehicles = context.world.ofType(Vehicle);
    return this.spots(gate, count).every((spot) =>
      vehicles.every(
        (vehicle) =>
          vehicle.transform.position.distanceTo(spot.position) >= this.def.slots.clearance,
      ),
    );
  }

  private spawn(context: ModeContext, gate: GateDef, count: number): EntityId[] {
    return this.spots(gate, count).map(
      (transform) =>
        context.world.add(
          createVehicle(this.def.enemy.vehicle, {
            transform,
            faction: 'insurgent',
            controller: new AiController(this.def.enemy.ai),
          }),
        ).id,
    );
  }

  /**
   * Where `count` tanks appear at `gate`, facing in, `inset` inside it: one
   * tank centred, two side by side `spacing` apart.
   */
  private spots(gate: GateDef, count: number): Transform[] {
    const { inset, spacing } = this.def.slots;
    const inward = Vec2.fromHeading(gate.heading);
    const across = Vec2.fromHeading(gate.heading + Math.PI / 2);
    const centre = gate.position.add(inward.scale(inset));
    const offsets =
      count === 1 ? [0] : Array.from({ length: count }, (_, i) => i - (count - 1) / 2);
    return offsets.map((offset) => ({
      position: centre.add(across.scale(offset * spacing)),
      heading: gate.heading,
    }));
  }
}
