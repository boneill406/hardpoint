import { FireLatch } from '../input/FireLatch';
import { GamepadDevice } from '../input/GamepadDevice';
import { PAD_SCHEMES } from '../input/bindings';
import { InputManager } from '../input/InputManager';
import { intentToCommand } from '../input/intentToCommand';
import { KeyboardMouseDevice } from '../input/KeyboardMouseDevice';
import { CAMERA_PRESETS } from '../render/camera/SliceCamera';
import { Renderer } from '../render/Renderer';
import type { EntityId } from '../sim/core/Entity';
import { FixedClock } from '../sim/core/FixedClock';
import { Simulation } from '../sim/core/Simulation';
import { Vec2 } from '../sim/core/Vec2';
import { ScriptedController } from '../sim/debug/ScriptedController';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { INSURGENT_TANK, PLAYER_TANK } from '../sim/defs/vehicles';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import { Vehicle } from '../sim/vehicles/Vehicle';
import { createVehicle } from '../sim/vehicles/VehicleFactory';
import { IDLE_COMMAND, type PlayerId, type VehicleCommand } from '../sim/vehicles/VehicleCommand';
import { HealthOverlay } from '../ui/HealthOverlay';
import { Hud } from '../ui/Hud';
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
 * Temporary debug scene (T-49): an insurgent tank circling (radius ≈ 2.9 u) in
 * open ground right of centre, as something to drive around and, from M2-3,
 * shove. Real enemies replace it in M4.
 */
const CIRCLER_START = { position: new Vec2(17.9, -3), heading: 0 };
const CIRCLE_COMMAND: VehicleCommand = { ...IDLE_COMMAND, throttle: 1, turn: -1 };

/**
 * Armor test dummies (M3 plan D8): idle insurgents in open ground ahead of the
 * player start, showing it their front, side and rear. Not respawned: reload
 * the page.
 */
const DUMMIES = [
  { position: new Vec2(-6, -9), shows: 0 },
  { position: new Vec2(0, -9.5), shows: Math.PI / 2 },
  { position: new Vec2(6, -9), shows: Math.PI },
];

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
      transform: SLICE_ARENA.playerStart,
      faction: 'player',
      controller: new PlayerController(PLAYER_ID),
    }),
  );
  addDummies(simulation);
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
    `Debug: fps cap ${debug.fps ?? 'off'}, interpolation ${debug.interpolate ? 'on' : 'off'}, pad scheme ${debug.pad}, grid ${debug.grid ? 'on' : 'off'}, camera ${debug.cam}, armor ${debug.armor ?? 'per def'}, hp ${debug.hp ? 'on' : 'off'}`,
  );

  for (const warning of debug.warnings) {
    console.warn(warning);
  }

  // The simulation can't run without physics, so load Rapier's WASM before anything else.
  const simulation = new Simulation({
    seed: SEED,
    physics: await RapierPhysicsWorld.create(),
    arena: SLICE_ARENA,
    populate: populateDebugScene,
    ...(debug.armor === undefined ? {} : { armorRule: debug.armor }),
  });
  const canvas = getCanvas();
  if (simulation.arena === undefined) {
    throw new Error('Simulation was created without an arena');
  }
  const renderer = new Renderer(canvas, {
    interpolate: debug.interpolate,
    arena: simulation.arena,
    grid: debug.grid,
    camera: CAMERA_PRESETS[debug.cam],
  });
  window.addEventListener('resize', () => renderer.resize());

  const input = new InputManager([
    new KeyboardMouseDevice(canvas, (x, y) => renderer.screenToGround(x, y)),
    new GamepadDevice(PAD_SCHEMES[debug.pad]),
  ]);
  const playerTank = findPlayerTank(simulation, PLAYER_ID);

  // Sim events → effects. Delivered by `flush()` after the frame's ticks, never mid-tick (D2).
  simulation.events.on('ProjectileImpact', ({ point, look }) => renderer.flashImpact(point, look));
  const overlay = debug.hp
    ? new HealthOverlay(document.body, debug.armor ?? 'per def (direction)')
    : undefined;
  simulation.events.on('Hit', ({ point, damage }) => overlay?.recordHit(point, damage));
  const hud = new Hud(document.body);
  const overlayProjector = {
    vehicle: (id: EntityId) => renderer.screenPositionOf(id, 1.6),
    point: (point: Vec2, height: number) => renderer.groundToScreen(point, height),
  };

  const clock = new FixedClock();
  const fireLatch = new FireLatch();
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
    const command = fireLatch.apply(intentToCommand(input.read(nowMs), playerTank.transform));
    const commands = new Map([[PLAYER_ID, command]]);

    const steps = clock.advance(elapsedSeconds);
    for (let i = 0; i < steps; i++) {
      simulation.tick(commands);
    }
    if (steps > 0) {
      fireLatch.consumed();
    }
    simulation.events.flush();
    renderer.render(simulation.world.all(), clock.alpha, playerTank.id, elapsedSeconds);
    hud.update(playerTank);
    overlay?.update(simulation.world.ofType(Vehicle), overlayProjector, elapsedSeconds);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
