import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { Arena } from '../sim/arena/Arena';
import type { Entity, EntityId } from '../sim/core/Entity';
import type { Vec2 } from '../sim/core/Vec2';
import { SliceCamera } from './camera/SliceCamera';
import { fromBabylonPosition, toBabylonPosition } from './coords';
import { RenderBridge, type RenderBridgeOptions } from './RenderBridge';
import { ArenaView } from './views/ArenaView';

export interface RendererOptions extends RenderBridgeOptions {
  /** Static arena geometry to build (floor, walls, gates). */
  readonly arena: Arena;
  /** Draw the 2 u debug grid on the floor (`?grid=on`). */
  readonly grid: boolean;
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

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    // antialias on; adaptToDeviceRatio so it renders crisply on Retina screens.
    this.engine = new Engine(canvas, true, undefined, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.09, 1);

    this.createLights();
    this.arenaView = new ArenaView(this.scene, options.arena, options.grid);

    this.sliceCamera = new SliceCamera(this.scene);
    this.sliceCamera.lookAt(Vector3.Zero());

    this.bridge = new RenderBridge(this.scene, options);
  }

  /**
   * Draws one frame: `alpha` (0..1) is how far real time is into the next tick
   * (`FixedClock`). The camera centres on `followId`'s drawn position. Hard
   * follow for now; M2-5 adds smoothing. `frameSeconds` is real time since the
   * last frame, for view-only animation.
   */
  render(
    entities: readonly Entity[],
    alpha: number,
    followId: EntityId,
    frameSeconds: number,
  ): void {
    this.bridge.sync(entities, alpha, frameSeconds);
    const followed = this.bridge.drawnTransform(followId);
    if (followed !== undefined) {
      this.sliceCamera.lookAt(toBabylonPosition(followed.position));
    }
    this.scene.render();
  }

  /**
   * The ground-plane point under canvas pixel (x, y), in CSS pixels as given by
   * pointer events; undefined if that pixel shows sky. Casts a ray from the camera
   * and intersects it with the floor (y = 0) directly, so it never depends on
   * which meshes happen to be under the cursor.
   */
  screenToGround(x: number, y: number): Vec2 | undefined {
    const ray = this.scene.createPickingRay(x, y, null, this.sliceCamera.camera);
    if (ray.direction.y >= 0) {
      return undefined;
    }
    const distance = -ray.origin.y / ray.direction.y;
    return fromBabylonPosition(ray.origin.add(ray.direction.scale(distance)));
  }

  /** Matches the drawing buffer to the canvas after the window changes size. */
  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.bridge.dispose();
    this.arenaView.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }

  private createLights(): void {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.55;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), this.scene);
    sun.intensity = 0.8;
  }
}
