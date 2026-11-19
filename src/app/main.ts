import { Renderer } from '../render/Renderer';
import { FixedClock } from '../sim/core/FixedClock';
import { Simulation } from '../sim/core/Simulation';
import { Vec2 } from '../sim/core/Vec2';
import { DebugMover, type DebugMoverOptions } from '../sim/debug/DebugMover';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import type { PlayerId, VehicleCommand } from '../sim/vehicles/VehicleCommand';
import { readDebugParams } from './debugParams';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop: each animation frame runs 0..n fixed ticks, delivers
 * their events, then renders between the last two ticks.
 */

const SEED = 1;
/** No input devices until M2-1. */
const NO_COMMANDS: ReadonlyMap<PlayerId, VehicleCommand> = new Map();

/**
 * Temporary M1 scene: two movers circling in opposite directions (radius =
 * speed / turnRate ≈ 6.7 u and 10 u), so position and heading both interpolate.
 */
const DEBUG_MOVERS: readonly (DebugMoverOptions & { readonly start: Vec2 })[] = [
  { start: new Vec2(-6.7, 0), speed: 6, turnRate: 0.9 },
  { start: new Vec2(10, 0), speed: 10, turnRate: -1 },
];

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
}

function populateDebugScene(simulation: Simulation): void {
  for (const { start, speed, turnRate } of DEBUG_MOVERS) {
    simulation.world.add(new DebugMover({ position: start, heading: 0 }, { speed, turnRate }));
  }
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
