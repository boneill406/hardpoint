import { Color3, Matrix, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { NavGrid } from '../../sim/ai/NavGrid';
import { toBabylonPosition } from '../coords';

/** Just above the floor, under everything else. */
const HEIGHT = 0.02;

/**
 * Debug view (`?nav=on`, M4 plan D15): tints every blocked navigation cell, so
 * you can see where enemies are allowed to drive. One flat square drawn once
 * per blocked cell with thin instances (a single draw call). Rebuilt only when
 * the sim hands over a new grid (a crate broke).
 */
export class NavGridView {
  private readonly mesh: Mesh;
  private shown: NavGrid | undefined;

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateGround('nav-cell', { width: 1, height: 1 }, scene);
    const material = new StandardMaterial('nav-cell-mat', scene);
    material.emissiveColor = new Color3(0.85, 0.2, 0.15);
    material.disableLighting = true;
    material.alpha = 0.3;
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.isVisible = false;
  }

  show(grid: NavGrid | undefined): void {
    if (grid === this.shown) {
      return;
    }
    this.shown = grid;
    if (grid === undefined) {
      this.mesh.isVisible = false;
      return;
    }
    const size = grid.options.cellSize * 0.92; // a hair smaller, so cells read as a grid
    const matrices: number[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (grid.isOpen(col, row)) {
          continue;
        }
        const at = toBabylonPosition(grid.centreOf({ col, row }), HEIGHT);
        const matrix = Matrix.Scaling(size, 1, size).multiply(Matrix.Translation(at.x, at.y, at.z));
        matrices.push(...matrix.asArray());
      }
    }
    this.mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16);
    this.mesh.isVisible = matrices.length > 0;
  }

  dispose(): void {
    this.mesh.dispose(false, true);
  }
}
