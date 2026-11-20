import { Color3, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { Arena } from '../../sim/arena/Arena';
import type { BoxDef } from '../../sim/arena/ArenaDef';
import { toBabylonPosition, toBabylonRotationY } from '../coords';

/** Spacing of the debug grid lines (`?grid=on`), in units. Helps judge scale and speed. */
const GRID_STEP = 2;
/** Gate marker size (u): a coloured panel on the wall's inner face. Glow and spawn warnings come in M5. */
const GATE = { width: 4, height: 1.6, depth: 0.1 };

/**
 * The arena's static geometry, built once from the sim's `Arena`: floor,
 * walls and gate markers (M2-4; clears T-20). Pillars and crates are entities
 * and get their own `PropView`s through `RenderBridge`.
 */
export class ArenaView {
  private readonly meshes: Mesh[] = [];

  constructor(scene: Scene, arena: Arena, showGrid: boolean) {
    this.createFloor(scene, arena);
    this.createWalls(scene, arena);
    this.createGates(scene, arena);
    if (showGrid) {
      this.createGrid(scene, arena);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose(false, true);
    }
  }

  private createFloor(scene: Scene, arena: Arena): void {
    const { width, depth } = arena.def;
    const floor = MeshBuilder.CreateGround('arena-floor', { width, height: depth }, scene);
    floor.material = flatMaterial(scene, 'arena-floor-mat', new Color3(0.32, 0.31, 0.27));
    this.meshes.push(floor);
  }

  private createWalls(scene: Scene, arena: Arena): void {
    const material = flatMaterial(scene, 'arena-wall-mat', new Color3(0.42, 0.41, 0.38));
    arena.walls.forEach((wall, i) => {
      const mesh = boxMesh(scene, `arena-wall-${i}`, wall, arena.def.wall.height);
      mesh.material = material;
      this.meshes.push(mesh);
    });
  }

  private createGates(scene: Scene, arena: Arena): void {
    const material = flatMaterial(scene, 'arena-gate-mat', new Color3(0.75, 0.6, 0.2));
    for (const gate of arena.def.gates) {
      const marker = MeshBuilder.CreateBox(`arena-gate-${gate.name}`, GATE, scene);
      // Sit the panel against the wall, facing into the arena (its local −z faces the wall).
      marker.position = toBabylonPosition(gate.position, GATE.height / 2);
      marker.rotation.y = toBabylonRotationY(gate.heading);
      marker.material = material;
      this.meshes.push(marker);
    }
  }

  private createGrid(scene: Scene, arena: Arena): void {
    const halfW = arena.halfWidth;
    const halfD = arena.halfDepth;
    const lift = 0.01; // just above the floor, to avoid z-fighting
    const lines: Vector3[][] = [];
    for (let x = -halfW; x <= halfW; x += GRID_STEP) {
      lines.push([new Vector3(x, lift, -halfD), new Vector3(x, lift, halfD)]);
    }
    for (let z = -halfD; z <= halfD; z += GRID_STEP) {
      lines.push([new Vector3(-halfW, lift, z), new Vector3(halfW, lift, z)]);
    }
    const grid = MeshBuilder.CreateLineSystem('debug-grid', { lines }, scene);
    grid.color = new Color3(0.45, 0.44, 0.39);
    grid.isPickable = false;
    this.meshes.push(grid);
  }
}

function boxMesh(scene: Scene, name: string, box: BoxDef, height: number): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: box.width, depth: box.depth, height }, scene);
  mesh.position = toBabylonPosition(box.center, height / 2);
  return mesh;
}

function flatMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  return material;
}
