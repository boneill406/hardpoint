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
import type { Vec2 } from '../sim/core/Vec2';
import { TANK_ARMOR } from '../sim/defs/armor';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import { Vehicle } from '../sim/vehicles/Vehicle';
import type { PlayerId } from '../sim/vehicles/VehicleCommand';
import { HealthOverlay } from '../ui/HealthOverlay';
import { AiStateLabels } from '../ui/AiStateLabels';
import { Banner } from '../ui/Banner';
import { Hud } from '../ui/Hud';
import { waveHudState } from '../ui/waveHud';
import { TelegraphSigns } from '../ui/TelegraphSigns';
import { readDebugParams } from './debugParams';
import { populateDebugScene } from './debugScene';
import { SLICE_WAVES } from '../sim/defs/waves';
import { WaveSurvivalMode, type WaveStatus } from '../sim/modes/WaveSurvivalMode';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop: each animation frame runs 0..n fixed ticks, delivers
 * their events, then renders between the last two ticks.
 */

const SEED = 1;
/** The one local player in the slice. */
const PLAYER_ID: PlayerId = 1;
/** Height (u) of the point the fire-telegraph sign sits on: just above the barrel tip. */
const MUZZLE_SIGN_HEIGHT = 1.0;

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
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
    `Debug: fps cap ${debug.fps ?? 'off'}, interpolation ${debug.interpolate ? 'on' : 'off'}, pad scheme ${debug.pad}, grid ${debug.grid ? 'on' : 'off'}, camera ${debug.cam}, armor ${debug.armor ?? 'per def'}, hp ${debug.hp ? 'on' : 'off'}, ${debug.mode === 'sandbox' ? `enemies ${debug.enemies}${debug.dummies ? ' + dummies' : ''}, ` : ''}ai ${debug.ai ? 'on' : 'off'}, nav ${debug.nav ? 'on' : 'off'}, mode ${debug.mode}${debug.mode === 'waves' ? ` from wave ${debug.wave}` : ''}`,
  );

  for (const warning of debug.warnings) {
    console.warn(warning);
  }

  const waves = new WaveSurvivalMode(SLICE_WAVES, { playerId: PLAYER_ID, startWave: debug.wave });
  // The simulation can't run without physics, so load Rapier's WASM before anything else.
  const simulation = new Simulation({
    seed: SEED,
    physics: await RapierPhysicsWorld.create(),
    arena: SLICE_ARENA,
    ...(debug.mode === 'sandbox'
      ? {
          populate: (sim: Simulation) =>
            populateDebugScene(sim, {
              playerId: PLAYER_ID,
              enemies: debug.enemies,
              dummies: debug.dummies,
            }),
        }
      : { mode: waves }),
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
    nav: debug.nav,
    ai: debug.ai,
  });
  window.addEventListener('resize', () => renderer.resize());

  const input = new InputManager([
    new KeyboardMouseDevice(canvas, (x, y) => renderer.screenToGround(x, y)),
    new GamepadDevice(PAD_SCHEMES[debug.pad]),
  ]);
  const playerTank = findPlayerTank(simulation, PLAYER_ID);

  // Sim events → effects. Delivered by `flush()` after the frame's ticks, never mid-tick (D2).
  simulation.events.on('GateWarning', ({ gate, seconds }) => renderer.warnGate(gate, seconds));
  simulation.events.on('RunEnded', ({ outcome, wave }) =>
    console.info(`Run ended: ${outcome} (wave ${wave})`),
  );
  simulation.events.on('ProjectileImpact', ({ point, look }) => renderer.flashImpact(point, look));
  const telegraphs = new TelegraphSigns(document.body);
  simulation.events.on('ShotTelegraphed', ({ shooter, hardpoint, seconds }) =>
    telegraphs.start(shooter, hardpoint, seconds),
  );
  simulation.events.on('TelegraphCancelled', ({ shooter, hardpoint }) =>
    telegraphs.end(shooter, hardpoint),
  );
  simulation.events.on('ShotFired', ({ shooter, hardpoint }) => telegraphs.end(shooter, hardpoint));
  const overlay = debug.hp
    ? new HealthOverlay(document.body, debug.armor ?? `per def (${TANK_ARMOR.faceRule})`)
    : undefined;
  simulation.events.on('Hit', ({ point, damage }) => overlay?.recordHit(point, damage));
  const hud = new Hud(document.body);
  simulation.events.on('BreatherStarted', ({ repaired }) => hud.flashRepair(repaired));
  const banner = new Banner(document.body);
  /** The wave run's status for the HUD; none in the sandbox. */
  const runStatus = (): WaveStatus | undefined =>
    debug.mode === 'waves' ? waves.status : undefined;
  const aiLabels = debug.ai ? new AiStateLabels(document.body) : undefined;
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
    const vehicles = simulation.world.ofType(Vehicle);
    renderer.updateDebug({ navGrid: simulation.navGrid, vehicles });
    renderer.render(simulation.world.all(), clock.alpha, playerTank.id, elapsedSeconds);
    const run = runStatus();
    hud.update(playerTank, run);
    banner.update(run === undefined ? undefined : waveHudState(run).banner);
    overlay?.update(vehicles, overlayProjector, elapsedSeconds);
    aiLabels?.update(vehicles, overlayProjector.vehicle);
    telegraphs.update((shooter, hardpoint) => {
      const vehicle = vehicles.find((candidate) => candidate.id === shooter);
      return vehicle && renderer.muzzleScreenPosition(vehicle, hardpoint, MUZZLE_SIGN_HEIGHT);
    }, elapsedSeconds);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
