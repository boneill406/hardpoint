import type { Renderer } from '../render/Renderer';
import { SHAKE_TRAUMA, type ImpactLook, type ImpactSurface } from '../render/vfx/effects';
import type { SimEvents } from '../sim/core/SimEvents';
import { Prop } from '../sim/arena/Prop';
import type { EntityId } from '../sim/core/Entity';
import { Simulation } from '../sim/core/Simulation';
import { Vec2 } from '../sim/core/Vec2';
import { TANK_ARMOR } from '../sim/defs/armor';
import { SLICE_ARENA } from '../sim/defs/arenas';
import { SLICE_WAVES } from '../sim/defs/waves';
import type { RunOutcome } from '../sim/modes/GameMode';
import { WaveSurvivalMode, type WaveStatus } from '../sim/modes/WaveSurvivalMode';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';
import { PlayerController } from '../sim/vehicles/controllers/PlayerController';
import type { WeaponMount } from '../sim/combat/WeaponMount';
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

/** Which gun fired: enough to find its mount. */
interface ShotRef {
  readonly shooter: EntityId;
  readonly hardpoint: string;
}

/** What a run needs from the app that outlives it. */
export interface SessionDeps {
  readonly debug: DebugParams;
  readonly renderer: Renderer;
  readonly hud: Hud;
  readonly playerId: PlayerId;
  /** The player destroyed a tank: the app's hit-stop (M6-1b). */
  readonly onPlayerKill: () => void;
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
  /** What each tank and prop is made of, for impact effects. */
  private readonly surfaces = new Map<EntityId, ImpactSurface>();

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

  /**
   * Remembers what each tank and prop is made of when it appears, because a
   * tank destroyed by a shot is already gone from the world when that shot's
   * `ProjectileImpact` is delivered (end of the tick).
   */
  private noteSurface(id: EntityId): void {
    const entity = this.simulation.world.get(id);
    if (entity instanceof Vehicle) {
      this.surfaces.set(id, 'metal');
    } else if (entity instanceof Prop) {
      this.surfaces.set(id, entity.destructible ? 'wood' : 'stone');
    }
  }

  /** Hit flash on the tank hit; shake when the player is hit or a tank dies nearby; hit-stop on the player's kills (M6-1b). */
  private feelHit(hit: SimEvents['Hit']): void {
    const { renderer, onPlayerKill } = this.deps;
    renderer.hitFlash(hit.target);
    if (hit.destroyed && this.surfaces.get(hit.target) === 'metal') {
      renderer.explode(hit.target, hit.point);
    }
    const player = this.playerTank.id;
    if (hit.target === player) {
      renderer.shake(SHAKE_TRAUMA.playerHit);
    }
    if (!hit.destroyed) {
      return;
    }
    const near =
      hit.point.distanceTo(this.playerTank.transform.position) <= SHAKE_TRAUMA.nearbyRadius;
    if (near && hit.target !== player) {
      renderer.shake(SHAKE_TRAUMA.nearbyKill);
    }
    if (hit.attacker === player && hit.target !== player) {
      onPlayerKill();
    }
  }

  /** Whether a shot is a cannon shell or an MG tracer, from the shooter's weapon on that hardpoint. */
  private lookOf(shot: ShotRef): ImpactLook {
    return this.mountOf(shot)?.mount.weapon.def.projectile.look ?? 'tracer';
  }

  /**
   * Where the gun's barrel meets its hardpoint (the hardpoint's place on the
   * turret or hull): casings are thrown from here (M6-2b).
   */
  private breechOf(shot: ShotRef): Vec2 | undefined {
    const found = this.mountOf(shot);
    if (found === undefined) {
      return undefined;
    }
    const { vehicle, mount } = found;
    const facing = vehicle.mountFacing(mount);
    const { forward, right } = mount.hardpoint.at;
    return vehicle
      .mountOrigin(mount)
      .add(Vec2.fromHeading(facing).scale(forward))
      .add(Vec2.fromHeading(facing + Math.PI / 2).scale(right));
  }

  private mountOf(shot: ShotRef): { vehicle: Vehicle; mount: WeaponMount } | undefined {
    const vehicle = this.simulation.world.get(shot.shooter);
    if (!(vehicle instanceof Vehicle)) {
      return undefined;
    }
    const mount = vehicle.mounts.find((candidate) => candidate.hardpoint.id === shot.hardpoint);
    return mount === undefined ? undefined : { vehicle, mount };
  }

  /** Walls (no target) are stone. */
  private surfaceOf(target: EntityId | undefined): ImpactSurface {
    return (target === undefined ? undefined : this.surfaces.get(target)) ?? 'stone';
  }

  /** Sim events → effects. Delivered by `flush()` after the frame's ticks, never mid-tick. */
  private subscribe(): void {
    const { events } = this.simulation;
    const { renderer, hud, onRunEnded } = this.deps;
    events.on('EntitySpawned', ({ id }) => this.noteSurface(id));
    events.on('ProjectileImpact', ({ point, look, target, normal }) =>
      renderer.impact(point, look, this.surfaceOf(target), normal),
    );
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
      if (shot.shooter === this.playerTank.id && this.lookOf(shot) === 'shell') {
        renderer.shake(SHAKE_TRAUMA.playerCannon);
      }
      renderer.shotFired(
        shot.shooter,
        shot.hardpoint,
        shot.origin,
        shot.heading,
        this.lookOf(shot),
        this.breechOf(shot) ?? shot.origin,
      );
      this.telegraphs.end(shot.shooter, shot.hardpoint);
      this.stats.onShotFired(shot);
    });
    events.on('Hit', (hit) => {
      this.overlay?.recordHit(hit.point, hit.damage);
      this.stats.onHit(hit);
      this.feelHit(hit);
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
