# ADR-0005: Rapier 2D for simulation physics

- **Status:** Accepted
- **Date:** 2026-11-19
- **Supersedes:** the Physics row of ADR-0002 (`@dimforge/rapier3d`). The rest of ADR-0002 stands.

## Context
Babylon renders the game in 3D, but every gameplay question in the slice is planar: hull vs. obstacle collision, swept projectiles, line of sight and pathfinding all happen on the ground plane. The simulation already models the world as `Vec2` (x, z) plus a heading (`architecture.md`, CLAUDE.md conventions).

Rapier ships separate 2D and 3D builds. ADR-0002 named `rapier3d` before this was considered; milestone M0-4 asked for the choice to be confirmed with a spike.

## Decision
Use **`@dimforge/rapier2d-compat`**, wrapped by `RapierPhysicsWorld` behind the `PhysicsWorld` interface (`src/sim/physics/`).

- Rapier's x/y plane is the simulation's ground plane (x, z). Rotation is a single angle: the heading.
- The world has no gravity: in a top-down game "down" is into the screen, not along the plane.
- The `-compat` build embeds the WASM in the JavaScript, so it loads the same way in Vite (browser) and Vitest (Node) with no WASM plugin or asset handling.
- Nothing outside `src/sim/physics/` imports Rapier.

## Spike results (2026-11-19, v0.21.0)
| | `rapier2d-compat` | `rapier3d-compat` |
|---|---|---|
| Loads in Vitest (Node) | Yes, ~32 ms | Yes, ~34 ms |
| Loads in the browser (Vite dev) | Yes | Not tested (same packaging) |
| Box-on-floor check | Rests at the exact expected height | Same |
| Bundle cost | 3.4 MB raw / 1.3 MB gzip | 4.3 MB raw / 1.7 MB gzip |

The size difference is minor next to Babylon (~6.3 MB); it did not decide the question.

## Alternatives considered
- **`rapier3d`.** Allows height-based gameplay (ramps, multi-level arenas, lobbed artillery, jumping or tipping vehicles). Rejected for now: none of that is in the slice or backlog, and every body would need its Y position and X/Z rotation locked, plus `Vec2`↔`Vec3` conversion in the adapter. If height ever becomes a mechanic, the larger cost is changing the simulation's own math and systems, which `rapier3d` would not avoid.
- **Non-compat build (`@dimforge/rapier2d`)** with a separate `.wasm` file. Smaller download, but needs a Vite WASM plugin and different loading in Node tests. Revisit only if load time matters.
- **`rapier2d-deterministic-compat`.** Bit-exact results across platforms, needed only for lockstep networking, which ADR-0001 rejected in favor of host-authoritative.

## Consequences
- ➕ The adapter maps sim types to Rapier almost one-to-one. Fewer axes means fewer bugs (no drifting Y, no accidental tipping).
- ➕ Same loading path in browser and tests.
- ➖ Visual height (e.g., a shell arcing) must be faked in rendering. Height-dependent gameplay (e.g., shells passing over low crates) would need explicit rules, such as a height tag that filters which colliders a projectile can hit.
- ➖ Switching to 3D later means rewriting `RapierPhysicsWorld`; `PhysicsWorld` keeps that change local to one class.

## Revisit when
Height becomes a gameplay mechanic (ramps, multi-level arenas, ballistic arcs that interact with cover).
