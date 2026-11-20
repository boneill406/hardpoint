import { GamepadDevice } from '../input/GamepadDevice';
import { PAD_SCHEMES } from '../input/bindings';
import { InputManager } from '../input/InputManager';
import { intentToCommand } from '../input/intentToCommand';
import { KeyboardMouseDevice } from '../input/KeyboardMouseDevice';
import { Renderer } from '../render/Renderer';
import { FixedClock } from '../sim/core/FixedClock';
import { Simulation } from '../sim/core/Simulation';
import { Vec2 } from '../sim/core/Vec2';
import { ScriptedController } from '../sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../sim/defs/vehicles';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import { Vehicle } from '../sim/vehicles/Vehicle';
import { createVehicle } from '../sim/vehicles/VehicleFactory';
import { IDLE_COMMAND, type PlayerId, type VehicleCommand } from '../sim/vehicles/VehicleCommand';
import { readDebugParams } from './debugParams';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop: each animation frame runs 0..n fixed ticks, delivers
 * their events, then renders between the last two ticks.
 */

const SEED = 1;
/** The one local player in the slice. */
const PLAYER_ID: PlayerId = 1;

/**
 * Temporary debug scene (T-49): the player's tank, plus an insurgent tank that
 * circles at full throttle as something to drive around (and, from M2-3, to
 * shove). Replaced by the arena's player start (M2-4) and real enemies (M4).
 */
const PLAYER_START = { position: new Vec2(0, -8), heading: 0 };
const CIRCLER_START = { position: new Vec2(8, 0), heading: 0 };
const CIRCLE_COMMAND: VehicleCommand = { ...IDLE_COMMAND, throttle: 1, turn: -0.6 };

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
}

function populateDebugScene(simulation: Simulation): void {
  simulation.world.add(
    createVehicle(PLAYER_TANK, {
      transform: PLAYER_START,
      faction: 'player',
      controller: new PlayerController(PLAYER_ID),
    }),
  );
  simulation.world.add(
    createVehicle(INSURGENT_TANK, {
      transform: CIRCLER_START,
      faction: 'insurgent',
      controller: new ScriptedController(() => CIRCLE_COMMAND),
    }),
  );
}

/** The vehicle driven by `playerId`; input needs its transform to resolve stick aim and `direct` driving. */
function findPlayerTank(simulation: Simulation, playerId: PlayerId): Vehicle {
  const tank = simulation.world
    .ofType(Vehicle)
    .find(
      (vehicle) =>
        vehicle.controller instanceof PlayerController && vehicle.controller.playerId === playerId,
    );
  if (tank === undefined) {
    throw new Error(`No vehicle for player ${playerId}`);
  }
  return tank;
}

/**
 * Lets a frame through at most `fps` times per second on average (`?fps=N`).
 * Without a cap every animation frame runs.
 */
function createFrameGate(fps: number | undefined): (nowMs: number) => boolean {
  if (fps === undefined) {
    return () => true;
  }
  const intervalMs = 1000 / fps;
  let nextDueMs = 0;
  return (nowMs) => {
    if (nowMs < nextDueMs) {
      return false;
    }
    // Schedule from the previous due time to keep the average rate; resync after a long pause.
    if (nowMs - nextDueMs > intervalMs) {
      nextDueMs = nowMs;
    }
    nextDueMs += intervalMs;
    return true;
  };
}

async function start(): Promise<void> {
  const debug = readDebugParams(window.location.search);
  console.info(
    `Debug: fps cap ${debug.fps ?? 'off'}, interpolation ${debug.interpolate ? 'on' : 'off'}, pad scheme ${debug.pad}`,
  );

  // The simulation can't run without physics, so load Rapier's WASM before anything else.
  const simulation = new Simulation({
    seed: SEED,
    physics: await RapierPhysicsWorld.create(),
    populate: populateDebugScene,
  });
  const canvas = getCanvas();
  const renderer = new Renderer(canvas, { interpolate: debug.interpolate });
  window.addEventListener('resize', () => renderer.resize());

  const input = new InputManager([
    new KeyboardMouseDevice(canvas, (x, y) => renderer.screenToGround(x, y)),
    new GamepadDevice(PAD_SCHEMES[debug.pad]),
  ]);
  const playerTank = findPlayerTank(simulation, PLAYER_ID);
  let aimPoint = playerTank.transform.position;

  const clock = new FixedClock();
  const frameGate = createFrameGate(debug.fps);
  let lastFrameMs: number | undefined;

  const frame = (nowMs: number): void => {
    requestAnimationFrame(frame);
    if (!frameGate(nowMs)) {
      return;
    }
    const elapsedSeconds = lastFrameMs === undefined ? 0 : (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;

    // Input is sampled once per frame; every tick this frame runs on the same command (T-56).
    const command = intentToCommand(input.read(nowMs), playerTank.transform, aimPoint);
    aimPoint = command.aimPoint;
    const commands = new Map([[PLAYER_ID, command]]);

    const steps = clock.advance(elapsedSeconds);
    for (let i = 0; i < steps; i++) {
      simulation.tick(commands);
    }
    simulation.events.flush();
    renderer.render(simulation.world.all(), clock.alpha);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
