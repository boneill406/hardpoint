import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Matrix,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { NavGrid } from '../sim/ai/NavGrid';
import type { Arena } from '../sim/arena/Arena';
import type { Entity, EntityId } from '../sim/core/Entity';
import { Vec2 } from '../sim/core/Vec2';
import type { Vehicle } from '../sim/vehicles/Vehicle';
import { SliceCamera, type CameraPreset } from './camera/SliceCamera';
import { fromBabylonPosition, toBabylonPosition } from './coords';
import { RenderBridge, type RenderBridgeOptions } from './RenderBridge';
import { AiDebugView } from './debug/AiDebugView';
import { NavGridView } from './debug/NavGridView';
import { ArenaView } from './views/ArenaView';
import { impactEffects, SHAKE, type ImpactLook, type ImpactSurface } from './vfx/effects';
import { CameraShake } from './camera/CameraShake';
import type { TrailedShell } from './vfx/ShellTrails';
import { Vfx } from './vfx/Vfx';
import { TankView } from './views/TankView';
import { Projectile } from '../sim/combat/Projectile';
import { FLIGHT_HEIGHT } from './views/ProjectileView';

/** A position on the canvas in CSS pixels from its top-left. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface RendererOptions extends RenderBridgeOptions {
  /** Static arena geometry to build (floor, walls, gates). */
  readonly arena: Arena;
  /** Draw the 2 u debug grid on the floor (`?grid=on`). */
  readonly grid: boolean;
  /** Camera angle, distance and field of view (`?cam=`). */
  readonly camera: CameraPreset;
  /** `?nav=on`: tint blocked navigation cells. */
  readonly nav: boolean;
  /** `?ai=on`: draw enemy paths and firing spots. */
  readonly ai: boolean;
  /** Screen shake on (`?shake=off` turns it off, M6-1b). */
  readonly shake: boolean;
}

/** What the debug views need each frame; ignored when they are off. */
export interface DebugState {
  readonly navGrid: NavGrid | undefined;
  readonly vehicles: readonly Vehicle[];
}

/**
 * Owns the Babylon engine and scene. Presentation only (ADR-0003): it reads
 * simulation state through `RenderBridge`, never writes it. The app layer owns
 * the frame loop and calls `render()` once per animation frame, after the ticks.
 */
export class Renderer {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly sliceCamera: SliceCamera;
  private readonly bridge: RenderBridge;
  private readonly arenaView: ArenaView;
  private readonly vfx: Vfx;
  private readonly shaker = new CameraShake(SHAKE);
  private readonly shakeOn: boolean;
  private readonly navView: NavGridView | undefined;
  private readonly aiView: AiDebugView | undefined;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    // antialias on; adaptToDeviceRatio so it renders crisply on Retina screens.
    this.engine = new Engine(canvas, true, undefined, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.09, 1);

    this.createLights();
    this.arenaView = new ArenaView(this.scene, options.arena, options.grid);

    const { arena } = options;
    const edgeX = arena.halfWidth + arena.def.wall.thickness;
    const edgeZ = arena.halfDepth + arena.def.wall.thickness;
    this.sliceCamera = new SliceCamera(this.scene, options.camera, {
      minX: -edgeX,
      maxX: edgeX,
      minZ: -edgeZ,
      maxZ: edgeZ,
      edgeHeight: arena.def.wall.height,
    });
    this.measureCameraView();

    this.bridge = new RenderBridge(this.scene, options);
    this.vfx = new Vfx(this.scene, FLIGHT_HEIGHT.shell);
    this.shakeOn = options.shake;
    this.navView = options.nav ? new NavGridView(this.scene) : undefined;
    this.aiView = options.ai ? new AiDebugView(this.scene) : undefined;
  }

  /**
   * Draws one frame: `alpha` (0..1) is how far real time is into the next tick
   * (`FixedClock`). The camera eases after `followId`'s drawn position.
   * `frameSeconds` is real time since the last frame, for view-only animation
   * and the camera ease.
   */
  render(
    entities: readonly Entity[],
    alpha: number,
    followId: EntityId,
    frameSeconds: number,
  ): void {
    this.bridge.sync(entities, alpha, frameSeconds);
    this.arenaView.update(frameSeconds);
    this.vfx.update(this.drawnShells(entities), frameSeconds);
    const followed = this.bridge.drawnTransform(followId);
    if (followed !== undefined) {
      this.sliceCamera.follow(followed.position, frameSeconds, this.shaker.update(frameSeconds));
    }
    // Our own frame loop drives rendering (the sim's fixed ticks come first), so do what
    // Babylon's runRenderLoop would: beginFrame measures the frame time. Without it Babylon
    // assumes 1 ms frames and runs particles and animations at ~6% speed (M6-1c).
    this.engine.beginFrame();
    this.scene.render();
    this.engine.endFrame();
  }

  /** Cannon shells as drawn this frame (interpolated), for their smoke trails. */
  private drawnShells(entities: readonly Entity[]): TrailedShell[] {
    const shells: TrailedShell[] = [];
    for (const entity of entities) {
      if (!(entity instanceof Projectile) || entity.weapon.projectile.look !== 'shell') {
        continue;
      }
      const drawn = this.bridge.drawnTransform(entity.id);
      if (drawn !== undefined) {
        shells.push({ id: entity.id, position: drawn.position });
      }
    }
    return shells;
  }

  /**
   * Forgets the last run (M5-4): every entity view, impact flash and gate
   * warning goes, and the camera snaps to the next followed tank. A new
   * `Simulation` numbers its entities from 1 again, so old views must not
   * be matched to new entities by id.
   */
  resetWorld(): void {
    this.bridge.clear();
    this.vfx.clear();
    this.shaker.reset();
    this.arenaView.clearWarnings();
    this.sliceCamera.reset();
  }

  /** Updates the debug views (`?nav=on`, `?ai=on`) before `render()`. Cheap when they are off. */
  updateDebug(state: DebugState): void {
    this.navView?.show(state.navGrid);
    this.aiView?.update(state.vehicles);
  }

  /**
   * The ground-plane point under canvas pixel (x, y), in CSS pixels as given by
   * pointer events; undefined if that pixel shows sky. Casts a ray from the camera
   * and intersects it with the floor (y = 0) directly, so it never depends on
   * which meshes happen to be under the cursor.
   */
  screenToGround(x: number, y: number): Vec2 | undefined {
    return this.screenToPlane(x, y, 0);
  }

  /** Like `screenToGround`, but onto the horizontal plane `height` u above the floor. */
  private screenToPlane(x: number, y: number, height: number): Vec2 | undefined {
    const ray = this.scene.createPickingRay(x, y, null, this.sliceCamera.camera);
    if (ray.direction.y >= 0) {
      return undefined;
    }
    const distance = (height - ray.origin.y) / ray.direction.y;
    return fromBabylonPosition(ray.origin.add(ray.direction.scale(distance)));
  }

  /**
   * Where entity `id` is on screen this frame (CSS pixels from the canvas's
   * top-left), `height` u above its drawn position; undefined if it isn't drawn
   * or is behind the camera. For HTML overlays; call after `render()`.
   */
  screenPositionOf(id: EntityId, height: number): ScreenPoint | undefined {
    const drawn = this.bridge.drawnTransform(id);
    return drawn === undefined ? undefined : this.groundToScreen(drawn.position, height);
  }

  /** Like `screenPositionOf`, for a fixed ground-plane point (e.g. where a shot hit). */
  groundToScreen(point: Vec2, height: number): ScreenPoint | undefined {
    const canvas = this.engine.getRenderingCanvas();
    if (canvas === null) {
      return undefined;
    }
    const width = this.engine.getRenderWidth();
    const heightPx = this.engine.getRenderHeight();
    const projected = Vector3.Project(
      toBabylonPosition(point, height),
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.sliceCamera.camera.viewport.toGlobal(width, heightPx),
    );
    if (projected.z < 0 || projected.z > 1) {
      return undefined;
    }
    // Render pixels → CSS pixels (the engine renders at the device pixel ratio).
    return {
      x: (projected.x / width) * canvas.clientWidth,
      y: (projected.y / heightPx) * canvas.clientHeight,
    };
  }

  /** Adds screen-shake trauma (0..1, M6-1b); ignored with `?shake=off`. */
  shake(trauma: number): void {
    if (this.shakeOn) {
      this.shaker.add(trauma);
    }
  }

  /** A tank took damage (`Hit`): it flashes white-hot. */
  hitFlash(id: EntityId): void {
    const view = this.bridge.viewOf(id);
    if (view instanceof TankView) {
      view.hitFlash();
    }
  }

  /**
   * A gun fired (`ShotFired`, M6-2a): its barrel recoils, fire and (for the
   * cannon) smoke leave the muzzle along the shot, and a cannon lights its
   * surroundings for a moment.
   */
  shotFired(
    shooter: EntityId,
    hardpoint: string,
    origin: Vec2,
    heading: number,
    look: ImpactLook,
  ): void {
    const view = this.bridge.viewOf(shooter);
    if (view instanceof TankView) {
      view.recoil(hardpoint);
    }
    const height = FLIGHT_HEIGHT[look];
    const forward = Vec2.fromHeading(heading);
    if (look === 'shell') {
      this.vfx.burst('muzzleCannon', origin, height, forward);
      this.vfx.burst('muzzleSmoke', origin, height, forward);
      this.vfx.flashLight(origin, height);
    } else {
      this.vfx.burst('muzzleMg', origin, height, forward);
    }
  }

  /**
   * A shot hit something (`ProjectileImpact`, M6-1a): sparks off a tank, dust
   * and grit off stone, dust and splinters off a crate, at the height the shot
   * flew, sprayed out of the surface along its normal.
   */
  impact(point: Vec2, look: ImpactLook, surface: ImpactSurface, normal: Vec2): void {
    for (const effect of impactEffects(surface, look)) {
      this.vfx.burst(effect, point, FLIGHT_HEIGHT[look], normal);
    }
  }

  /**
   * Where `vehicle`'s muzzle on `hardpoint` is on screen this frame, `height` u
   * up: the sim's muzzle offset applied to the vehicle's drawn (interpolated)
   * position, so overlays stay glued to the tank between ticks. Undefined if the
   * vehicle isn't drawn, has no such hardpoint, or is off-screen.
   */
  muzzleScreenPosition(
    vehicle: Vehicle,
    hardpoint: string,
    height: number,
  ): ScreenPoint | undefined {
    const drawn = this.bridge.drawnTransform(vehicle.id);
    const mount = vehicle.mounts.find((candidate) => candidate.hardpoint.id === hardpoint);
    if (drawn === undefined || mount === undefined) {
      return undefined;
    }
    const offset = vehicle.muzzlePosition(mount).sub(vehicle.transform.position);
    return this.groundToScreen(drawn.position.add(offset), height);
  }

  /** A spawn group is due out of `gate` (`GateWarning`, M5-2): blink that gate for `seconds`. */
  warnGate(gate: string, seconds: number): void {
    this.arenaView.warnGate(gate, seconds);
  }

  /** Matches the drawing buffer to the canvas after the window changes size. */
  resize(): void {
    this.engine.resize();
    this.measureCameraView();
  }

  dispose(): void {
    this.bridge.dispose();
    this.vfx.dispose();
    this.navView?.dispose();
    this.aiView?.dispose();
    this.arenaView.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }

  /** The camera's visible ground patch depends on the canvas aspect ratio; re-measure on resize. */
  private measureCameraView(): void {
    const canvas = this.engine.getRenderingCanvas();
    if (canvas === null) {
      return;
    }
    this.sliceCamera.measureView(canvas.clientWidth, canvas.clientHeight, (x, y, height) =>
      this.screenToPlane(x, y, height),
    );
  }

  private createLights(): void {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.55;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), this.scene);
    sun.intensity = 0.8;
  }
}
