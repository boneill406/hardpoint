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
import { SliceCamera } from './camera/SliceCamera';

/**
 * Arena side length in units (GDD §6). Temporary: from M2-4 the floor is built
 * from the simulation's ArenaDef instead of this constant.
 */
const ARENA_SIZE = 46;
/** Spacing of the debug grid lines, in units. Helps judge scale and camera angle. */
const GRID_STEP = 2;

/**
 * Owns the Babylon engine and scene. Presentation only (ADR-0003): it will read
 * simulation state through RenderBridge, never write it. The app layer owns the
 * frame loop and calls `render()` once per animation frame.
 */
export class Renderer {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly sliceCamera: SliceCamera;

  constructor(canvas: HTMLCanvasElement) {
    // antialias on; adaptToDeviceRatio so it renders crisply on Retina screens.
    this.engine = new Engine(canvas, true, undefined, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.07, 0.08, 0.09, 1);

    this.createLights();
    this.createFloor();

    this.sliceCamera = new SliceCamera(this.scene);
    this.sliceCamera.lookAt(Vector3.Zero());
  }

  /** Draws one frame. */
  render(): void {
    this.scene.render();
  }

  /** Matches the drawing buffer to the canvas after the window changes size. */
  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
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
