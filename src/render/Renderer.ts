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
import type { Vec2 } from '../sim/core/Vec2';
import type { Vehicle } from '../sim/vehicles/Vehicle';
import { SliceCamera, type CameraPreset } from './camera/SliceCamera';
import { fromBabylonPosition, toBabylonPosition } from './coords';
import { RenderBridge, type RenderBridgeOptions } from './RenderBridge';
import { AiDebugView } from './debug/AiDebugView';
import { NavGridView } from './debug/NavGridView';
import { ArenaView } from './views/ArenaView';
import { ImpactFlashes } from './vfx/ImpactFlashes';

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
  private readonly impacts: ImpactFlashes;
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
    this.impacts = new ImpactFlashes(this.scene);
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
    this.impacts.update(frameSeconds);
    const followed = this.bridge.drawnTransform(followId);
    if (followed !== undefined) {
      this.sliceCamera.follow(followed.position, frameSeconds);
    }
    this.scene.render();
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

  /** A shot hit something: show the placeholder impact flash there (M6 replaces it). */
  flashImpact(point: Vec2, look: 'shell' | 'tracer'): void {
    this.impacts.spawn(point, look);
  }

  /** Matches the drawing buffer to the canvas after the window changes size. */
  resize(): void {
    this.engine.resize();
    this.measureCameraView();
  }

  dispose(): void {
    this.bridge.dispose();
    this.impacts.dispose();
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
