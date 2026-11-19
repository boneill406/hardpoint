/**
 * The simulation's view of the physics engine. Game rules depend on this
 * interface, never on Rapier directly, so the engine can be swapped or faked in
 * tests without touching gameplay code (ADR-0005).
 *
 * Deliberately minimal for M0. Bodies, colliders and queries (ray and shape casts)
 * are added in M2-3, when collision first needs them.
 */
export interface PhysicsWorld {
  /** Advances the physics world by one fixed simulation step of `dt` seconds. */
  step(dt: number): void;

  /** Frees engine memory. Rapier's lives in WASM, outside JavaScript's garbage collector. */
  dispose(): void;
}
