# ADR-0003: Simulation decoupled from rendering

- **Status:** Accepted
- **Date:** 2026-11-18

## Context
Babylon.js's idiomatic style puts game logic on scene objects: behaviors attached to meshes, logic in `scene.onBeforeRenderObservable`, physics bodies on meshes. The prototype did the equivalent in Three.js. For example, the tank's heading *was* `chassis.rotation.y`, and collision boxes were derived from render meshes. That caused untestable code and collision bugs (see `lessons-learned.md`).

Since the code is being rewritten anyway, this is the cheapest moment to choose either approach.

## Decision
Gameplay lives in a pure-TypeScript **simulation layer** (`src/sim/`) that never imports Babylon or any browser API. Babylon owns **presentation only**: models, animation, effects, camera, audio and UI.

- `src/sim/` may not import from `src/render/`, `src/input/`, `src/ui/`, `src/app/`, or `@babylonjs/*`. Enforced by ESLint and CI.
- The render layer reads simulation state each frame (interpolated) and reacts to simulation events. It never writes simulation state.
- Collision shapes are defined by the simulation, never derived from meshes.

## Alternatives considered
- **Babylon-native (logic on scene objects).** Less code upfront and closer to Babylon tutorials. Rejected because it breaks unit testing, ties the simulation tick to a variable render loop (conflicts with ADR-0001), and makes chassis/walker swaps a rendering concern.

## Consequences
- ➕ Game logic is unit-testable in Node with no browser.
- ➕ Chassis types and cosmetics (e.g., procedural walker legs) can change without touching gameplay.
- ➕ Co-op host can run the simulation authoritatively.
- ➕ The renderer could be replaced without rewriting gameplay.
- ➖ A sync layer (`RenderBridge`) is needed to map entities to views.
- ➖ Some Babylon features (physics plugin, behaviors, mesh-based picking for gameplay) go unused for gameplay.

## Revisit when
Not expected. This is foundational.
