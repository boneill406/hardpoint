import type { EntityId } from './Entity';

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
}
