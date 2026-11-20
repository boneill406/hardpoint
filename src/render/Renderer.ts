import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { Entity } from '../sim/core/Entity';
import type { Vec2 } from '../sim/core/Vec2';
import { SliceCamera } from './camera/SliceCamera';
import { fromBabylonPosition } from './coords';
import { RenderBridge, type RenderBridgeOptions } from './RenderBridge';

/**
 * Arena side length in units (GDD §6). Temporary: from M2-4 the floor is built
 * from the simulation's ArenaDef instead of this constant.
 */
const ARENA_SIZE = 46;
/** Spacing of the debug grid lines, in units. Helps judge scale and camera angle. */
const GRID_STEP = 2;

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

  constructor(canvas: HTMLCanvasElement, options: RenderBridgeOptions) {
    // antialias on; adaptToDeviceRatio so it renders crisply on Retina screens.
    this.engine = new Engine(canvas, true, undefined, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.09, 1);

    this.createLights();
    this.createFloor();

    this.sliceCamera = new SliceCamera(this.scene);
    this.sliceCamera.lookAt(Vector3.Zero());

    this.bridge = new RenderBridge(this.scene, options);
  }

  /** Draws one frame: `alpha` (0..1) is how far real time is into the next tick (`FixedClock`). */
  render(entities: readonly Entity[], alpha: number): void {
    this.bridge.sync(entities, alpha);
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

  private createFloor(): void {
    const ground = MeshBuilder.CreateGround(
      'arena-floor',
      { width: ARENA_SIZE, height: ARENA_SIZE },
      this.scene,
    );
    const material = new StandardMaterial('arena-floor-mat', this.scene);
    material.diffuseColor = new Color3(0.32, 0.31, 0.27);
    material.specularColor = Color3.Black();
    ground.material = material;

    this.createGrid();
  }

  private createGrid(): void {
    const half = ARENA_SIZE / 2;
    const lift = 0.01; // just above the floor, to avoid z-fighting
    const lines: Vector3[][] = [];
    for (let offset = -half; offset <= half; offset += GRID_STEP) {
      lines.push([new Vector3(offset, lift, -half), new Vector3(offset, lift, half)]);
      lines.push([new Vector3(-half, lift, offset), new Vector3(half, lift, offset)]);
    }
    const grid = MeshBuilder.CreateLineSystem('debug-grid', { lines }, this.scene);
    grid.color = new Color3(0.45, 0.44, 0.39);
    grid.isPickable = false;
  }
}
