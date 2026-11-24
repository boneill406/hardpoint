import type { Arena } from '../arena/Arena';
import type { EventBus } from '../core/EventBus';
import type { Rng } from '../core/Rng';
import type { SimEvents } from '../core/SimEvents';
import type { World } from '../core/World';

/** How a run ended. */
export type RunOutcome = 'victory' | 'defeat';

/**
 * What a game mode may use, handed to it by the `Simulation` inside the tick.
 * Unlike controllers (which only read), a mode is part of the rules: it adds
 * vehicles and emits run events.
 */
export interface ModeContext {
  /** Completed ticks before this one. */
  readonly tick: number;
  readonly world: World;
  readonly arena: Arena;
  readonly events: EventBus<SimEvents>;
  /** The simulation's only random source, so the same seed gives the same run. */
  readonly rng: Rng;
}

/**
 * Spawning, progression and win/lose (architecture.md §4). Vehicles, combat and
 * AI are the same in every mode; a mode decides who arrives, when, and when the
 * run is over. `WaveSurvivalMode` is the slice's; a Robokill-style room mode
 * would be another implementation.
 */
export interface GameMode {
  /** Once, when the simulation is built (after the arena): spawn the starting entities. */
  start(context: ModeContext): void;
  /** Every tick, after removals (tick phase 6): spawn, advance, check the end. */
  update(context: ModeContext): void;
  /** Set once the run is over; the mode does nothing more after that. */
  readonly outcome: RunOutcome | undefined;
}
