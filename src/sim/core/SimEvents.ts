import type { WeaponSlot } from '../vehicles/VehicleDef';
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
    readonly target: EntityId | undefined;
    readonly point: Vec2;
    readonly normal: Vec2;
  };
}
