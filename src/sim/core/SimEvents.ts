import type { HitZone } from '../combat/ArmorDef';
import type { WeaponSlot } from '../vehicles/VehicleDef';
import type { RunOutcome } from '../modes/GameMode';
import type { EntityId } from './Entity';
import type { Vec2 } from './Vec2';

/**
 * Every event the simulation emits, keyed by name, with its payload type.
 * `EventBus<SimEvents>` uses this map so `emit` and `on` are checked at compile
 * time: a misspelt event name or a wrong payload field fails typecheck.
 *
 * Gameplay events (`ShotFired`, `Hit`, `WaveStarted`, ...) are added by the
 * milestones that introduce them (M3+).
 */
export interface SimEvents {
  /** An entity was added to the world this tick. */
  EntitySpawned: { readonly id: EntityId };
  /** An entity was removed from the world at the end of this tick. */
  EntityDestroyed: { readonly id: EntityId };
  /**
   * Two vehicles started touching this tick (once per impact, not every tick
   * they keep pushing). `impulse` (mass × u/s) is how hard; drives the clash
   * juice in M6 (GDD §8).
   */
  VehiclesCollided: { readonly a: EntityId; readonly b: EntityId; readonly impulse: number };
  /** A weapon fired this tick (muzzle flash, sound, recoil in M6; projectiles in M3-3). */
  ShotFired: {
    readonly shooter: EntityId;
    readonly slot: WeaponSlot;
    readonly hardpoint: string;
    readonly weapon: string;
    readonly origin: Vec2;
    readonly heading: number;
  };
  /**
   * A projectile struck something and stopped. `target` is the vehicle or prop
   * hit, or undefined for a wall. Impact sparks and sounds hang off this (M6);
   * damage is `Hit` (M3-4).
   */
  ProjectileImpact: {
    readonly projectile: EntityId;
    readonly weapon: string;
    /** The projectile's look (shell / tracer), so effects can scale with it. */
    readonly look: 'shell' | 'tracer';
    readonly target: EntityId | undefined;
    /** A gun barrel (damaged by the armor's `barrel` multiplier since M4-5) or the `body`. */
    readonly part: 'body' | 'barrel';
    readonly point: Vec2;
    readonly normal: Vec2;
  };
  /**
   * A shot damaged a vehicle (M3-4): emitted after its `ProjectileImpact`.
   * Hit flashes, the HUD and the `?hp=on` overlay hang off this. A hit that
   * destroys the target also removes it (`EntityDestroyed` at the end of the tick).
   */
  Hit: {
    readonly target: EntityId;
    /** Who fired; friendly fire counts (GDD §5). */
    readonly attacker: EntityId;
    readonly weapon: string;
    /** The hull face, or `barrel` (M4-5). */
    readonly face: HitZone;
    /** Health removed, after the armor multiplier. */
    readonly damage: number;
    readonly healthLeft: number;
    readonly destroyed: boolean;
    readonly point: Vec2;
  };
  /**
   * A weapon began its windup (M4-5): it will fire in `seconds` unless the
   * trigger is released. Drives the enemy fire telegraph (hazard sign).
   */
  ShotTelegraphed: {
    readonly shooter: EntityId;
    readonly hardpoint: string;
    readonly weapon: string;
    readonly seconds: number;
  };
  /** A windup ended without a shot (trigger released, e.g. sight lost): hide the telegraph. */
  TelegraphCancelled: { readonly shooter: EntityId; readonly hardpoint: string };
  /** A wave began: its banner shows now (M5). `enemies` is the wave's total. */
  WaveStarted: { readonly wave: number; readonly waves: number; readonly enemies: number };
  /**
   * `count` tanks will come out of `gate` in `seconds` (M5-2): the gate glows.
   * Emitted again for another gate if this one is blocked when they're due.
   */
  GateWarning: { readonly gate: string; readonly count: number; readonly seconds: number };
  /**
   * The breather began and the player's tank was repaired (M5-3): `amount` is
   * what was actually added (0 at full armor), `seconds` the countdown.
   */
  BreatherStarted: {
    readonly wave: number;
    readonly seconds: number;
    readonly repaired: number;
    readonly healthNow: number;
  };
  /** Every enemy of the wave has been destroyed. */
  WaveCleared: { readonly wave: number };
  /** The run is over: the player was destroyed, or the last wave was cleared. */
  RunEnded: { readonly outcome: RunOutcome; readonly wave: number };
}
