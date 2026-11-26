import { FireLatch } from '../input/FireLatch';
import { GamepadDevice } from '../input/GamepadDevice';
import { PAD_SCHEMES } from '../input/bindings';
import { InputGate } from '../input/InputGate';
import { InputManager } from '../input/InputManager';
import { intentToCommand } from '../input/intentToCommand';
import { KeyboardMouseDevice } from '../input/KeyboardMouseDevice';
import { MenuInput } from '../input/MenuInput';
import type { MenuAction } from '../input/menuMapping';
import { CAMERA_PRESETS } from '../render/camera/SliceCamera';
import { Renderer } from '../render/Renderer';
import { Arena } from '../sim/arena/Arena';
import { FixedClock } from '../sim/core/FixedClock';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { SLICE_WAVES } from '../sim/defs/waves';
import { Vehicle } from '../sim/vehicles/Vehicle';
import { IDLE_COMMAND, type PlayerId } from '../sim/vehicles/VehicleCommand';
import { amountLabel } from '../ui/amountLabel';
import { Banner } from '../ui/Banner';
import { Hud } from '../ui/Hud';
import { MenuScreen, type MenuContent } from '../ui/MenuScreen';
import { waveHudState } from '../ui/waveHud';
import { readDebugParams, type DebugParams } from './debugParams';
import { GameFlow, type FlowState } from './GameFlow';
import { GameSession } from './GameSession';
import { HitStop } from './HitStop';
import { formatAccuracy, formatRunTime, type RunStatsSummary } from './RunStats';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop: each animation frame runs 0..n fixed ticks (only while
 * the `GameFlow` says the game is running), delivers their events, then
 * renders between the last two ticks. Menus, pause and restart (M5-4) live
 * here; each run's simulation lives in a `GameSession`.
 */

/** Hit-stop on the player's kills (GDD §8: ~60 ms). */
const HIT_STOP_SECONDS = 0.06;

/** The one local player in the slice. */
const PLAYER_ID: PlayerId = 1;

const PAUSE_ITEMS = ['Resume', 'Restart', 'Title'] as const;
const SUMMARY_ITEMS = ['Restart', 'Title'] as const;

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
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

/** Each run gets a fresh seed unless `?seed=` pins one (M5 plan D9). Randomness is fine here: this is the app, not the sim. */
function seedFor(debug: DebugParams): number {
  return debug.seed ?? Math.floor(Math.random() * 2 ** 31);
}

function logDebug(debug: DebugParams): void {
  console.info(
    `Debug: fps cap ${debug.fps ?? 'off'}, interpolation ${debug.interpolate ? 'on' : 'off'}, pad scheme ${debug.pad}, grid ${debug.grid ? 'on' : 'off'}, camera ${debug.cam}, armor ${debug.armor ?? 'per def'}, hp ${debug.hp ? 'on' : 'off'}, ${debug.mode === 'sandbox' ? `enemies ${debug.enemies}${debug.dummies ? ' + dummies' : ''}, ` : ''}ai ${debug.ai ? 'on' : 'off'}, nav ${debug.nav ? 'on' : 'off'}, mode ${debug.mode}${debug.mode === 'waves' ? ` from wave ${debug.wave}` : ''}, seed ${debug.seed ?? 'new each run'}`,
  );
  for (const warning of debug.warnings) {
    console.warn(warning);
  }
}

/** The summary's stats as label–value rows (GDD §9). */
function summaryRows(stats: RunStatsSummary): [string, string][] {
  return [
    ['Waves cleared', `${stats.wavesCleared} / ${SLICE_WAVES.waves.length}`],
    ['Time', formatRunTime(stats.seconds)],
    ['Kills', String(stats.kills)],
    ...stats.weapons.map((weapon): [string, string] => [weapon.weapon, formatAccuracy(weapon)]),
    ['Damage taken', amountLabel(stats.damageTaken)],
  ];
}

/** What the menu shows on each screen; undefined = no menu. */
function menuFor(state: FlowState, session: GameSession, flow: GameFlow): MenuContent | undefined {
  switch (state) {
    case 'title':
      return { title: 'HARDPOINT', lines: ['Press any key / A to start'], items: [] };
    case 'paused':
      return { title: 'PAUSED', items: PAUSE_ITEMS };
    case 'summary':
      return {
        title: flow.outcome === 'victory' ? 'VICTORY' : 'DEFEAT',
        tone: flow.outcome === 'victory' ? 'good' : 'bad',
        table: summaryRows(session.stats.summary()),
        lines: [`Seed ${session.seed}`],
        items: SUMMARY_ITEMS,
      };
    case 'playing':
    case 'ending':
      return undefined;
  }
}

async function start(): Promise<void> {
  const debug = readDebugParams(window.location.search);
  logDebug(debug);

  const canvas = getCanvas();
  const renderer = new Renderer(canvas, {
    interpolate: debug.interpolate,
    arena: new Arena(SLICE_ARENA),
    grid: debug.grid,
    camera: CAMERA_PRESETS[debug.cam],
    nav: debug.nav,
    ai: debug.ai,
    shake: debug.shake,
  });
  window.addEventListener('resize', () => renderer.resize());

  const input = new InputManager([
    new KeyboardMouseDevice(canvas, (x, y) => renderer.screenToGround(x, y)),
    new GamepadDevice(PAD_SCHEMES[debug.pad]),
  ]);
  const menuInput = new MenuInput();
  const hud = new Hud(document.body);
  const banner = new Banner(document.body);
  // The sandbox has no run to start or end: straight into play.
  const hitStop = new HitStop(debug.hitstop);
  const flow = new GameFlow(debug.mode === 'waves' ? 'title' : 'playing');

  const deps = {
    debug,
    renderer,
    hud,
    playerId: PLAYER_ID,
    onRunEnded: (outcome: 'victory' | 'defeat') => flow.runEnded(outcome),
    onPlayerKill: () => hitStop.trigger(HIT_STOP_SECONDS),
  };
  // Physics loads asynchronously; the first session must exist before the first frame.
  let session = await GameSession.create(seedFor(debug), deps);
  let clock = new FixedClock();
  const gate = new InputGate();
  /** True while a new session is being built: input is ignored, nothing ticks. */
  let switching = false;

  const newRun = async (next: 'title' | 'playing'): Promise<void> => {
    switching = true;
    menu.hide();
    session.dispose();
    renderer.resetWorld();
    session = await GameSession.create(seedFor(debug), deps);
    clock = new FixedClock();
    flow.newRun(next);
    gate.block(); // the Enter / A / click that chose Restart may still be held
    switching = false;
  };
  const restart = (): void => void newRun('playing');
  const toTitle = (): void => void newRun('title');

  const menu = new MenuScreen(document.body, (index) => {
    if (flow.state === 'paused') {
      [() => flow.resume(), restart, toTitle][index]?.();
    } else if (flow.state === 'summary') {
      [restart, toTitle][index]?.();
    }
  });

  // Leaving the window pauses (plan D8), so the run doesn't carry on unseen.
  const pauseOnLeave = (): void => {
    flow.pause();
  };
  window.addEventListener('blur', pauseOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseOnLeave();
    }
  });

  const handleMenu = (actions: readonly MenuAction[]): void => {
    if (switching) {
      return;
    }
    const has = (action: MenuAction): boolean => actions.includes(action);
    switch (flow.state) {
      case 'title':
        if (has('any')) flow.start();
        break;
      case 'playing':
        if (has('back') || has('pause')) flow.pause();
        break;
      case 'paused':
        if (has('back') || has('pause')) {
          flow.resume();
          break;
        }
        if (has('up')) menu.move(-1);
        if (has('down')) menu.move(1);
        if (has('confirm')) menu.confirm();
        break;
      case 'summary':
        if (has('up')) menu.move(-1);
        if (has('down')) menu.move(1);
        if (has('confirm')) menu.confirm();
        break;
      case 'ending':
        break;
    }
  };

  const fireLatch = new FireLatch();
  const frameGate = createFrameGate(debug.fps);
  let lastFrameMs: number | undefined;
  let shownState: FlowState | undefined;

  const frame = (nowMs: number): void => {
    requestAnimationFrame(frame);
    if (!frameGate(nowMs)) {
      return;
    }
    const elapsedSeconds = lastFrameMs === undefined ? 0 : (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;

    // While a new run is being built nothing is drawn: the old run is disposed, and its
    // views must not be matched to the new run's entities (ids restart at 1).
    if (switching) {
      return;
    }
    const before = flow.state;
    handleMenu(menuInput.read());
    if (switching) {
      return; // a menu choice just started a restart
    }
    // Input is sampled once per frame; every tick this frame runs on the same command (T-56).
    // Outside steady play the tank idles, so the key that started or resumed the run doesn't fire.
    if (before !== 'playing' && flow.state === 'playing') {
      gate.block(); // just started or resumed: wait for the starting key to be let go
    }
    const intent = gate.filter(input.read(nowMs));
    const steadyPlay = before === 'playing' && flow.state === 'playing';
    const command = steadyPlay
      ? fireLatch.apply(intentToCommand(intent, session.playerTank.transform))
      : IDLE_COMMAND;
    const { simulation } = session;
    hitStop.update(elapsedSeconds);
    // Hit-stop holds the sim like pause does; the frame still renders (M6-1b).
    if (flow.ticking && !hitStop.frozen) {
      const steps = clock.advance(elapsedSeconds);
      for (let i = 0; i < steps; i++) {
        simulation.tick(new Map([[PLAYER_ID, command]]));
      }
      if (steps > 0) {
        fireLatch.consumed();
      }
    } else if (!flow.ticking) {
      fireLatch.consumed(); // menus: drop presses; a hit-stop keeps them for the next tick
    }
    simulation.events.flush();
    flow.update(elapsedSeconds);

    if (flow.state !== shownState) {
      shownState = flow.state;
      const content = menuFor(flow.state, session, flow);
      if (content === undefined) {
        menu.hide();
      } else {
        menu.show(content);
      }
    }

    renderer.updateDebug({
      navGrid: simulation.navGrid,
      vehicles: simulation.world.ofType(Vehicle),
    });
    renderer.render(simulation.world.all(), clock.alpha, session.playerTank.id, elapsedSeconds);
    const run = session.status;
    hud.setVisible(flow.state !== 'title');
    hud.update(session.playerTank, run);
    const inPlay = flow.state === 'playing' || flow.state === 'ending';
    banner.update(run === undefined || !inPlay ? undefined : waveHudState(run).banner);
    session.updateOverlays(elapsedSeconds);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
