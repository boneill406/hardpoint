import { Renderer } from '../render/Renderer';
import { FixedClock } from '../sim/core/FixedClock';
import { Simulation } from '../sim/core/Simulation';
import { TICK_RATE } from '../sim/core/time';
import { Vec2 } from '../sim/core/Vec2';
import { ScriptedController } from '../sim/debug/ScriptedController';
import { INSURGENT_TANK, PLAYER_TANK } from '../sim/defs/vehicles';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { createVehicle } from '../sim/vehicles/VehicleFactory';
import { IDLE_COMMAND, type PlayerId, type VehicleCommand } from '../sim/vehicles/VehicleCommand';
import { readDebugParams } from './debugParams';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop: each animation frame runs 0..n fixed ticks, delivers
 * their events, then renders between the last two ticks.
 */

const SEED = 1;
/** No input devices until M2-2. */
const NO_COMMANDS: ReadonlyMap<PlayerId, VehicleCommand> = new Map();

/**
 * Temporary debug scene until player input (M2-2): the player tank repeats a
 * 5 s routine that shows acceleration, braking and slower reverse; an insurgent
 * tank circles at full throttle.
 */
const ROUTINE: readonly {
  readonly seconds: number;
  readonly throttle: number;
  readonly turn: number;
}[] = [
  { seconds: 2, throttle: 1, turn: 0.25 },
  { seconds: 1, throttle: 0, turn: 0 },
  { seconds: 1.5, throttle: -1, turn: 0 },
  { seconds: 0.5, throttle: 0, turn: 0 },
];
const ROUTINE_TICKS = ROUTINE.reduce((sum, step) => sum + step.seconds * TICK_RATE, 0);

function routineCommand(tick: number): VehicleCommand {
  let remaining = tick % ROUTINE_TICKS;
  for (const step of ROUTINE) {
    const ticks = step.seconds * TICK_RATE;
    if (remaining < ticks) {
      return { ...IDLE_COMMAND, throttle: step.throttle, turn: step.turn };
    }
    remaining -= ticks;
  }
  return IDLE_COMMAND;
}

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
      transform: { position: new Vec2(-4, -6), heading: 0 },
      faction: 'player',
      controller: new ScriptedController(routineCommand),
    }),
  );
  simulation.world.add(
    createVehicle(INSURGENT_TANK, {
      transform: { position: new Vec2(8, 0), heading: 0 },
      faction: 'insurgent',
      controller: new ScriptedController(() => CIRCLE_COMMAND),
    }),
  );
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
    `Debug: fps cap ${debug.fps ?? 'off'}, interpolation ${debug.interpolate ? 'on' : 'off'}`,
  );

  // The simulation can't run without physics, so load Rapier's WASM before anything else.
  const simulation = new Simulation({
    seed: SEED,
    physics: await RapierPhysicsWorld.create(),
    populate: populateDebugScene,
  });
  const renderer = new Renderer(getCanvas(), { interpolate: debug.interpolate });
  window.addEventListener('resize', () => renderer.resize());

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

    const steps = clock.advance(elapsedSeconds);
    for (let i = 0; i < steps; i++) {
      simulation.tick(NO_COMMANDS);
    }
    simulation.events.flush();
    renderer.render(simulation.world.all(), clock.alpha);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
