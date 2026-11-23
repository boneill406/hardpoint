import type { Simulation } from '../sim/core/Simulation';
import { Vec2 } from '../sim/core/Vec2';
import { ScriptedController } from '../sim/debug/ScriptedController';
import { INSURGENT_AI } from '../sim/defs/ai';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { INSURGENT_TANK, PLAYER_TANK } from '../sim/defs/vehicles';
import { AiController } from '../sim/vehicles/controllers/AiController';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import { createVehicle } from '../sim/vehicles/VehicleFactory';
import { IDLE_COMMAND, type PlayerId } from '../sim/vehicles/VehicleCommand';

export interface DebugSceneOptions {
  readonly playerId: PlayerId;
  /** Hunting insurgents (0–3), from the top, then left, then right gate. */
  readonly enemies: number;
  /** The M3 armor dummies (`?dummies=on`). */
  readonly dummies: boolean;
}

/** Gate order for `?enemies=N`. */
const GATE_ORDER = ['top', 'left', 'right'];
/** How far inside its gate an insurgent starts (u): clear of the wall, barrel included. */
const SPAWN_INSET = 2.5;

/**
 * Armor test dummies (M3 plan D8): idle insurgents in open ground ahead of the
 * player start, showing it their front, side and rear.
 */
const DUMMIES = [
  { position: new Vec2(-6, -9), shows: 0 },
  { position: new Vec2(0, -9.5), shows: Math.PI / 2 },
  { position: new Vec2(6, -9), shows: Math.PI },
];

/**
 * The debug scene until waves arrive in M5 (M4 plan D14): the player at the
 * start and up to three hunting insurgents from the gates. Not respawned:
 * reload the page.
 */
export function populateDebugScene(simulation: Simulation, options: DebugSceneOptions): void {
  simulation.world.add(
    createVehicle(PLAYER_TANK, {
      transform: SLICE_ARENA.playerStart,
      faction: 'player',
      controller: new PlayerController(options.playerId),
    }),
  );
  for (const name of GATE_ORDER.slice(0, options.enemies)) {
    const gate = SLICE_ARENA.gates.find((g) => g.name === name);
    if (gate === undefined) {
      continue;
    }
    simulation.world.add(
      createVehicle(INSURGENT_TANK, {
        transform: {
          position: gate.position.add(Vec2.fromHeading(gate.heading).scale(SPAWN_INSET)),
          heading: gate.heading,
        },
        faction: 'insurgent',
        controller: new AiController(INSURGENT_AI),
      }),
    );
  }
  if (options.dummies) {
    addDummies(simulation);
  }
}

function addDummies(simulation: Simulation): void {
  for (const dummy of DUMMIES) {
    // Nose toward the player start, then turned so the chosen face points at it.
    const towardStart = SLICE_ARENA.playerStart.position.sub(dummy.position).heading();
    simulation.world.add(
      createVehicle(INSURGENT_TANK, {
        transform: { position: dummy.position, heading: towardStart + dummy.shows },
        faction: 'insurgent',
        controller: new ScriptedController(() => IDLE_COMMAND),
      }),
    );
  }
}
