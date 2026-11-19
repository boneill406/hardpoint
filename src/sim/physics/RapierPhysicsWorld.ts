import RAPIER from '@dimforge/rapier2d-compat';
import type { PhysicsWorld } from './PhysicsWorld';

/** Shared across worlds: the WASM module only needs to load once per page/process. */
let wasmReady: Promise<void> | undefined;

function loadRapier(): Promise<void> {
  wasmReady ??= RAPIER.init();
  return wasmReady;
}

/**
 * `PhysicsWorld` backed by Rapier 2D (ADR-0005). Rapier's x/y plane is the
 * simulation's ground plane (x, z), so no axis is locked or ignored.
 *
 * Created through the async `create()` because Rapier must load its WASM module
 * before any world can exist.
 */
export class RapierPhysicsWorld implements PhysicsWorld {
  private readonly world: RAPIER.World;

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  /** Loads Rapier (first call only) and returns an empty world. */
  static async create(): Promise<RapierPhysicsWorld> {
    await loadRapier();
    // Top-down game: "down" is into the screen, not along the plane, so no gravity.
    return new RapierPhysicsWorld(new RAPIER.World({ x: 0, y: 0 }));
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
