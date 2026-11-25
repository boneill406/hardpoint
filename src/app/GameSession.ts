import type { Renderer } from '../render/Renderer';
import type { EntityId } from '../sim/core/Entity';
import { Simulation } from '../sim/core/Simulation';
import type { Vec2 } from '../sim/core/Vec2';
import { TANK_ARMOR } from '../sim/defs/armor';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { SLICE_WAVES } from '../sim/defs/waves';
import type { RunOutcome } from '../sim/modes/GameMode';
import { WaveSurvivalMode, type WaveStatus } from '../sim/modes/WaveSurvivalMode';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import { Vehicle } from '../sim/vehicles/Vehicle';
import type { PlayerId } from '../sim/vehicles/VehicleCommand';
import { AiStateLabels } from '../ui/AiStateLabels';
import { EdgeIndicators, type EdgeTarget } from '../ui/EdgeIndicators';
import { HealthOverlay } from '../ui/HealthOverlay';
import type { Hud } from '../ui/Hud';
import { TelegraphSigns } from '../ui/TelegraphSigns';
import type { DebugParams } from './debugParams';
import { RunStats } from './RunStats';
import { populateDebugScene } from './debugScene';

/** Height (u) of the point the fire-telegraph sign sits on: just above the barrel tip. */
const MUZZLE_SIGN_HEIGHT = 1.0;
/** Height (u) measured for edge arrows: about a hull's middle. */
const EDGE_HEIGHT = 0.8;

/** What a run needs from the app that outlives it. */
export interface SessionDeps {
  readonly debug: DebugParams;
  readonly renderer: Renderer;
  readonly hud: Hud;
  readonly playerId: PlayerId;
  /** Called once when the sim reports `RunEnded`. */
  readonly onRunEnded: (outcome: RunOutcome) => void;
}

/**
 * One run (M5-4, plan D9): its `Simulation`, its game mode, and the overlays
 * that track its entities (fire warnings, health bars, AI labels). Restart
 * disposes this and builds a new one, so nothing from the old run can leak
 * into the next: there is no reset code to forget a field in. The renderer,
 * input, HUD and menus outlive it.
 */
export class GameSession {
  readonly simulation: Simulation;
  readonly playerTank: Vehicle;
  /** The run's numbers for the summary (M5-5), counted from events. */
  readonly stats: RunStats;
  private readonly waves: WaveSurvivalMode | undefined;
  private readonly telegraphs: TelegraphSigns;
  private readonly overlay: HealthOverlay | undefined;
  private readonly aiLabels: AiStateLabels | undefined;
  private readonly edges: EdgeIndicators;

  /** Physics (Rapier's WASM) loads asynchronously, so sessions are built with this. */
  static async create(seed: number, deps: SessionDeps): Promise<GameSession> {
    return new GameSession(seed, await RapierPhysicsWorld.create(), deps);
  }

  private constructor(
    readonly seed: number,
    physics: RapierPhysicsWorld,
    private readonly deps: SessionDeps,
  ) {
    const { debug, playerId } = deps;
    this.waves =
      debug.mode === 'waves'
        ? new WaveSurvivalMode(SLICE_WAVES, { playerId, startWave: debug.wave })
        : undefined;
    this.simulation = new Simulation({
      seed,
      physics,
      arena: SLICE_ARENA,
      ...(this.waves === undefined
        ? {
            populate: (sim: Simulation) =>
              populateDebugScene(sim, {
                playerId,
                enemies: debug.enemies,
                dummies: debug.dummies,
              }),
          }
        : { mode: this.waves }),
      ...(debug.armor === undefined ? {} : { armorRule: debug.armor }),
    });
    this.playerTank = findPlayerTank(this.simulation, playerId);
    this.stats = new RunStats(
      this.playerTank.id,
      this.playerTank.mounts.map((mount) => mount.weapon.def.name),
    );
    this.telegraphs = new TelegraphSigns(document.body);
    this.overlay = debug.hp
      ? new HealthOverlay(document.body, debug.armor ?? `per def (${TANK_ARMOR.faceRule})`)
      : undefined;
    this.aiLabels = debug.ai ? new AiStateLabels(document.body) : undefined;
    this.edges = new EdgeIndicators(document.body);
    this.subscribe();
  }

  /** The wave run's status for the HUD; undefined in the sandbox. */
  get status(): WaveStatus | undefined {
    return this.waves?.status;
  }

  /** Once per frame after rendering: overlays that follow entities on screen. */
  updateOverlays(frameSeconds: number): void {
    const { renderer } = this.deps;
    const vehicles = this.simulation.world.ofType(Vehicle);
    const projector = {
      vehicle: (id: EntityId) => renderer.screenPositionOf(id, 1.6),
      point: (point: Vec2, height: number) => renderer.groundToScreen(point, height),
    };
    this.overlay?.update(vehicles, projector, frameSeconds);
    this.aiLabels?.update(vehicles, projector.vehicle);
    this.telegraphs.update((shooter, hardpoint) => {
      const vehicle = vehicles.find((candidate) => candidate.id === shooter);
      return vehicle && renderer.muzzleScreenPosition(vehicle, hardpoint, MUZZLE_SIGN_HEIGHT);
    }, frameSeconds);
    this.edges.update(
      this.edgeTargets(vehicles),
      window.innerWidth,
      window.innerHeight,
      frameSeconds,
    );
  }

  /** Enemies, and gates in their spawn warning, for the off-screen arrows (M5-6b). */
  private edgeTargets(vehicles: readonly Vehicle[]): EdgeTarget[] {
    const { renderer } = this.deps;
    const enemies = vehicles
      .filter((vehicle) => vehicle.faction !== this.playerTank.faction)
      .map((vehicle): EdgeTarget => ({
        key: `enemy-${vehicle.id}`,
        kind: 'enemy',
        at: renderer.screenPositionOf(vehicle.id, EDGE_HEIGHT),
      }));
    const gates = this.edges.warnedGates.map((name): EdgeTarget => {
      const gate = SLICE_ARENA.gates.find((candidate) => candidate.name === name);
      return {
        key: `gate-${name}`,
        kind: 'gate',
        at: gate && renderer.groundToScreen(gate.position, EDGE_HEIGHT),
      };
    });
    return [...gates, ...enemies];
  }

  dispose(): void {
    this.simulation.dispose();
    this.telegraphs.dispose();
    this.overlay?.dispose();
    this.aiLabels?.dispose();
    this.edges.dispose();
  }

  /** Sim events → effects. Delivered by `flush()` after the frame's ticks, never mid-tick. */
  private subscribe(): void {
    const { events } = this.simulation;
    const { renderer, hud, onRunEnded } = this.deps;
    events.on('ProjectileImpact', ({ point, look }) => renderer.flashImpact(point, look));
    events.on('GateWarning', ({ gate, seconds }) => {
      renderer.warnGate(gate, seconds);
      this.edges.warnGate(gate, seconds);
    });
    events.on('ShotTelegraphed', ({ shooter, hardpoint, seconds }) =>
      this.telegraphs.start(shooter, hardpoint, seconds),
    );
    events.on('TelegraphCancelled', ({ shooter, hardpoint }) =>
      this.telegraphs.end(shooter, hardpoint),
    );
    events.on('ShotFired', (shot) => {
      this.telegraphs.end(shot.shooter, shot.hardpoint);
      this.stats.onShotFired(shot);
    });
    events.on('Hit', (hit) => {
      this.overlay?.recordHit(hit.point, hit.damage);
      this.stats.onHit(hit);
    });
    events.on('BreatherStarted', ({ repaired }) => hud.flashRepair(repaired));
    events.on('WaveCleared', () => this.stats.onWaveCleared());
    events.on('RunEnded', ({ outcome }) => {
      this.stats.setTicks(this.simulation.tickCount);
      onRunEnded(outcome);
    });
  }
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
