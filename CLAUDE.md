# CLAUDE.md — Hardpoint

Browser-based 3D arcade tank combat game (working title **Hardpoint**). Inspirations: Wii Play Tanks, Robokill, Halo's Mantis. Current goal: the **vertical slice**, wave survival in one arena.

Solo hobby project by Brendan (software engineer). He wants Claude to do most of the implementation **with clear explanations of what was built and why**, so he understands the codebase. He learns from a mix of reading and doing; diagrams help.

## Documentation (source of truth)
- `docs/vision.md`: pillars and scope guardrails
- `docs/gdd.md`: slice design, tuning values, acceptance criteria
- `docs/architecture.md`: layers, classes, folder layout, frame flow
- `docs/milestones.md`: milestones and task IDs
- `docs/adr/`: architecture decisions (ADR-0001 to 0004)
- `docs/lessons-learned.md`: why the prototype failed (don't repeat it)

@docs/architecture.md

Read `gdd.md` and the relevant milestone before starting a task. When a decision changes, update the docs in the same change. Never edit an accepted ADR's decision; write a new ADR that supersedes it.

## Stack
TypeScript (strict) · Vite · Babylon.js (rendering, VFX, audio) · Rapier (physics, simulation only) · Vitest · ESLint + Prettier · npm · GitHub Actions.

## Commands
_(Created in milestone M0. Update this list if they change.)_
- `npm run dev`: dev server
- `npm run build`: production build
- `npm test`: Vitest
- `npm run lint` / `npm run typecheck` / `npm run format` (`format:check` in CI; Prettier skips `*.md`)

## Hard architecture rules
1. **`src/sim/` is pure TypeScript.** It must not import from `src/render/`, `src/input/`, `src/ui/`, `src/app/`, `@babylonjs/*`, or browser APIs (`window`, `document`). ESLint enforces this; never disable that rule.
2. **No `Math.random()` or `Date.now()` in `src/sim/`.** Use the simulation's `Rng` and tick count.
3. **The simulation changes only through `Simulation.tick(commands)`.** Rendering, input and UI never write simulation state.
4. **The render layer is read-only.** It reads (interpolated) state and reacts to sim events. Gameplay logic never goes on Babylon scene objects, behaviors or observables.
5. **Collision shapes come from the simulation**, never from mesh bounds.
6. **Fixed 60 Hz timestep** for the simulation; rendering interpolates.
7. **Composition over inheritance.** Inheritance max one level (`Entity → Vehicle | Projectile | Prop`). Variation via interfaces (`Locomotion`, `Controller`, `FireLimiter`, `PhysicsWorld`, `GameMode`).
8. **Content is data.** New vehicle or weapon variants are new defs in `src/sim/defs/`, not new classes, unless new behavior is required. Tuning numbers live in defs, never inline.

## Code conventions
- One exported class per file; file named after the class (`TrackedLocomotion.ts`). Named exports only.
- Interfaces have no `I` prefix (`Locomotion`, not `ILocomotion`).
- No `any`. Prefer `readonly` and explicit return types on public methods.
- Units: distance in units (`u`), time in seconds, angles in radians. Sim uses ground-plane `Vec2` (x, z) + heading. Conversion to Babylon coordinates happens only in `src/render/coords.ts`.
- Short JSDoc on public classes and methods explaining *why*, not *what*.
- Keep functions small; avoid clever one-liners.

## Testing
- Every simulation feature gets Vitest tests in `tests/` mirroring `src/sim/`.
- Test names describe behavior: `"cannon hit 10° off front deals front-armor damage"`.
- Tests use fixed seeds; no real timers.
- Rendering code isn't unit-tested; verify it by running the game.

## Workflow
1. **Plan first.** For each task, state the plan (files, classes, tests) and wait for approval before writing code.
2. **Ask before:** adding a dependency, changing an interface listed above, or deviating from the GDD/architecture.
3. **Flag scope creep.** If something isn't in the current milestone or the GDD, say so and propose adding it to the post-slice backlog instead.
4. Work on a branch per task (`m2-3-collision`). Small commits; messages start with the task ID (`M2-3: oriented hull collision`).
5. **Definition of done:** lint, typecheck, tests and build pass; docs updated if behavior or decisions changed; acceptance items for the task demonstrated.
6. **Finish with an explanation:** what was built, how it fits the architecture, any trade-offs, and anything Brendan should try in the game. Be concise; no filler or praise.
