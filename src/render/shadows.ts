import type { AbstractMesh } from '@babylonjs/core';

/**
 * Which meshes cast shadows (M6-7a, GDD §7): tanks, pillars, crates and walls
 * opt in here when they are built. The sun's shadow map collects them every
 * frame through a predicate, so views created mid-game (a new tank, a crate)
 * need no extra wiring, and disposed meshes simply drop out. A weak set, so a
 * disposed mesh isn't kept alive by being registered.
 */
const casters = new WeakSet<AbstractMesh>();

/** Registers `mesh` as a shadow caster; it also receives shadows (a tank shades its own tracks). */
export function castShadow(mesh: AbstractMesh): void {
  casters.add(mesh);
  mesh.receiveShadows = true;
}

export function castsShadow(mesh: AbstractMesh): boolean {
  return casters.has(mesh);
}
