# Trade-offs Register

_Hardpoint. Every deliberate trade-off: what was chosen, what was given up, and when to look again. Last updated 2026-11-19._

**How to use**
- One row per trade-off, with a stable ID (`T-nn`). Never renumber; if a trade-off is reversed, set its status to **Reversed** and name the task that reversed it.
- Big, hard-to-reverse decisions also get an ADR; the row links to it.
- `docs/dev-log.md` entries cite these IDs instead of repeating the text. Actionable debt ("do X in M2-4") is tracked in the dev log's **Open follow-ups**.

**Status:** **Active** = still in effect · **Temporary** = planned to go away at a known milestone · **Reversed** = no longer applies.

---

## Toolchain and dependencies

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-01 | TypeScript pinned to **6.0.3** (M0-1) | TypeScript 7.x (latest) | typescript-eslint supports TS `<6.1` only; type-aware linting needs it | Miss TS 7's much faster native compiler | typescript-eslint supports TS 7 | Active |
| T-02 | Exact dependency versions (`save-exact`) (M0-1) | Caret ranges (`^1.2.3`) | Reproducible installs; the prototype broke on unpinned CDN versions | Upgrades are manual | Never; upgrade on purpose | Active |
| T-03 | Avoid days-old releases; Babylon pinned to **9.34.0** (two weeks old) (M0-3) | Latest (9.37.1, released that day) | Time for regressions and supply-chain problems to surface | Slightly behind on fixes | Each dependency upgrade | Active |
| T-04 | `engines: >=22.12` locally, CI on Node 26 via `.nvmrc` (M0-1) | Requiring Node 26 everywhere | Avoid blocking installs on older local Node | Local and CI Node can differ | If a Node-version bug appears | Active |
| T-05 | No `@types/node` (M0-5) | Installing it up front | Nothing needs Node APIs yet; one less dependency | Tool code using `process` etc. won't typecheck | First tool code that needs Node APIs | Active |
| T-06 | Each tool installed with the task that uses it (`test`, `lint`, `format`, Babylon, Rapier) (M0-1) | Installing everything in M0-1 | No failing stub scripts; each dependency arrives with a reason | None significant | — | Active |

## TypeScript, lint and formatting

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-07 | Strictness beyond `strict`: `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, unused locals/params (M0-1) | Plain `strict` | Catches index bugs, silent overrides in `Entity` subclasses, messy imports | More `undefined` checks in array/map code | Never | Active |
| T-08 | Boundary rules via ESLint's built-in `no-restricted-*` rules (M0-6) | A plugin such as `eslint-plugin-boundaries` | One less dependency; the rules are simple | Can't express rules like "render may import sim but ui may not import render" | Layer rules get more complex | Active |
| T-09 | `no-restricted-syntax` repeated in the sim block (M0-6) | One shared definition | Flat config replaces a rule's options per block instead of merging | Must update both places if the named-export rule changes | — | Active |
| T-10 | `eslint.config.js` in plain JS, type-aware rules off for it (M0-6) | `eslint.config.ts` | Avoids a TS config loader; keeps the config outside the TS project | The config file itself isn't type-checked | Config grows complex | Active |
| T-11 | Prettier skips `*.md` (M0-6) | Formatting docs too | Prettier pads tables into aligned columns, so every small doc edit becomes a whole-table diff | Doc formatting is by hand | — | Active |
| T-12 | No barrel files; import modules directly (M0-2) | `index.ts` re-exporting each folder | Barrels invite circular imports (`Vehicle` ↔ `combat`) and hide where classes live | Longer import paths | — | Active |

## Testing

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-13 | Lint-boundary tests run only the 4 boundary rules, type-aware parsing off (M0-5) | Running the full config | Snippets use non-existent file paths, which type-aware parsing rejects; boundary rules don't need types | Type-aware rules aren't covered by these tests (they are by `npm run lint`) | — | Active |
| T-14 | `tests/tooling/` for config guard tests (M0-5) | Strictly mirroring `src/sim/` | The lint guard isn't sim code but must run in CI | One test folder doesn't mirror `src/` | — | Active |
| T-15 | `tests/sim/` subfolders created only when tests exist (M0-2) | Mirroring all folders up front | Git doesn't track empty folders; no placeholder noise | None | — | Active |
| T-16 | `RapierPhysicsWorld` tests only prove load and step (M0-4) | Collision behavior tests now | No bodies or queries exist yet | Physics behavior untested until M2-3 | M2-3 | Temporary |

## Rendering

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-17 | Import Babylon from the `@babylonjs/core` root (M0-3) | Per-module "pure" imports (tree-shaking) | Pure modules need manual side-effect registration or fail at runtime (e.g., missing shaders) | ~6.3 MB of Babylon in the bundle | Load time matters | Active |
| T-18 | `main.ts` owns the frame loop (`requestAnimationFrame`) (M0-3) | Babylon's `engine.runRenderLoop` | The M1 fixed-step sim runs before each render; the app layer must control the order | Slightly less idiomatic Babylon | — | Active |
| T-19 | Camera: 58° elevation, 34 u distance, narrow FOV 0.75 rad (M0-3) | Wider FOV / other values | First guess; narrow FOV reduces perspective distortion at a high angle | Untuned | M2-5 (real tank on screen) | Temporary |
| T-20 | `ARENA_SIZE` constant and 2 u debug grid inside `Renderer` (M0-3) | Building the floor from `ArenaDef` | `ArenaDef` doesn't exist yet | Tuning number outside `defs/` (CLAUDE.md rule 8) | M2-4 | Temporary |
| T-21 | Vite chunk warning raised to just above the current size (10.5 MB) (M0-3, M0-4) | Silencing it or code-splitting | ADR-0002 accepts a large bundle; a tight limit still flags real growth | Must be bumped deliberately when a big dependency is added | Each large dependency | Active |

## Physics

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-22 | **Rapier 2D** (M0-4, [ADR-0005](adr/0005-rapier-2d-physics.md)) | Rapier 3D | The sim is planar (`Vec2` + heading): no axis locking or `Vec3` conversion | Height-based gameplay needs a rewrite of the adapter (and the sim's math) | Height becomes a mechanic | Active |
| T-23 | `-compat` Rapier build, WASM embedded in JS (M0-4) | Separate `.wasm` file | Loads identically in Vite and Vitest with no WASM plugin | +~1 MB versus a separate binary | Load time matters | Active |
| T-24 | `PhysicsWorld` limited to `step` / `dispose` (M0-4) | Designing the body/query API now | Avoid guessing an API before collision needs it | M2-3 extends a listed interface | M2-3 | Temporary |
| T-25 | Private constructor + async `create()` for `RapierPhysicsWorld` (M0-4) | Public constructor + separate `init()` | A world can't exist before WASM loads | Callers must `await` | — | Active |
| T-26 | `main.ts` creates a physics world directly as a smoke check (M0-4) | Waiting for `Simulation` | Proves Rapier loads in the browser in M0 | App wiring touches a sim internal | M1-5 (`Simulation` owns physics) | Reversed (M1-5): `main.ts` only constructs the adapter and hands it to `Simulation`, which steps and disposes it |

## Simulation core

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-32 | Immutable `Vec2` class; every operation returns a new instance (M1-1) | Mutable vectors or in-place `addInPlace`-style methods | No aliasing bugs: a stored position or `previousTransform` can't change behind your back | One small allocation per operation; negligible at slice scale (tens of entities) | Profiling shows vector allocation / GC as a hotspot | Active |
| T-33 | Trig via `Math.sin` / `cos` / `atan2` (M1-1) | Deterministic software trig or fixed-point math | Fast and simple. Determinism holds on one JS engine, which is all M1-7 tests and solo play need | The spec lets engines differ in the last bits of `Math.sin` etc., so Chrome vs. Firefox runs of the same seed may drift apart | Lockstep co-op/networking or cross-browser replays (`RemoteController`) | Active |
| T-34 | **mulberry32** PRNG, one 32-bit state word (M1-3) | xoshiro128** / sfc32 (128-bit state), or a library | Tiny, fast, integer-only (identical on every JS engine, unlike T-33); state snapshots are one number | Period 2^32 and weaker statistics than modern generators; fine for spread, spawns and AI choices, not for anything needing high-quality randomness | A test or game feature shows visible patterns, or far more than ~4 billion draws per run | Active |
| T-35 | `Rng` throws on invalid input (non-integer seed, reversed `int` bounds, empty `pick`) (M1-3) | Clamping or returning a default | These are always caller bugs; failing fast surfaces a bad def immediately instead of quietly skewing a run | A bad def crashes the sim rather than degrading | — | Active |
| T-36 | `FixedClock` runs at most **5** catch-up steps per frame and drops the rest of the backlog (M1-2) | Running every missed step, or clamping frame time | Avoids the "spiral of death" where catching up takes longer than a frame. 5 steps covers frames down to 12 fps at full speed | After a stall over ~83 ms, game time falls behind real time (brief slow motion); fine solo, but co-op peers would drift apart | Networked play (needs the server's tick, not local catch-up) | Active |
| T-37 | Tick rate (`TICK_RATE`, `TICK_SECONDS`) in `src/sim/core/time.ts` (M1-2) | Putting it in `src/sim/defs/` (rule 8) | It's an engine constant every system integrates against, not content to tune per vehicle or weapon | A rule-8 reader might look for it in `defs/` | Tick rate becomes a player or debug setting | Active |
| T-38 | **Buffered events**: `emit` queues, `flush()` delivers after the frame's ticks (M1-4, plan D2) | Synchronous delivery inside `emit` | Render/audio/HUD code never runs mid-tick or sees half-updated state; the sim's tick stays pure and easy to test | Effects can start up to one frame (~16 ms) after the tick that caused them; a handler can't react within the same tick | Something needs same-tick reaction (it should then be sim logic, not an event handler) | Active |
| T-39 | A throwing event handler propagates out of `flush()` (M1-4) | Catching per handler and continuing | Fail fast, like T-35; a swallowed error in a VFX handler would hide bugs | The rest of that flush's events are lost (the queue was already taken) | Handler errors in production builds need to be survivable | Active |
| T-40 | **Deferred entity removal**: `World.remove` marks, `applyRemovals()` deletes at the end of the tick (M1-5) | Removing immediately | Systems never iterate a list that shrinks under them; every system in a tick sees the same set of entities | A destroyed entity stays in queries until the tick ends (a dead tank could still act later that tick); systems that care must check | A bug where a "dead" entity acts in its last tick | Active |
| T-41 | `DebugMover` as a temporary fourth `Entity` subclass in `src/sim/debug/` (M1-5, plan D1) | An early `Projectile` | Tests the loop and interpolation without designing projectiles early | Breaks the "three subclasses" rule for one milestone; `Simulation.tick` names it directly | M2: deleted when `Vehicle` exists | Temporary |
| T-42 | `World.add(entity)` assigns the id; `Entity.id` throws until then (M1-5) | A factory `world.add((id) => new Tank(id, ...))` so `id` is `readonly` from construction | Keeps the architecture's `add(entity)` signature and simple construction | An entity briefly exists without an id; reading it early throws instead of being caught at compile time | Ids are read before `add` in practice | Active |
| T-43 | `Simulation.tick` runs explicit phases over `world.ofType(...)` (M1-5) | A polymorphic `entity.update()` on every entity | The order things happen in a tick (architecture.md §5) is visible in one method, not spread across subclasses | Each new entity behaviour needs a line in `tick` | Tick phases grow unwieldy (then extract per-phase systems) | Active |
| T-44 | `World.ofType` scans every entity with `instanceof` on each call (M1-5) | Per-class index maintained on add/remove | Simple; always in insertion order | O(n) per query, several queries per tick | Profiling shows it (hundreds of entities) | Active |
| T-45 | Determinism test uses **real Rapier** and compares full snapshots every 60 ticks, within one JS engine (M1-7) | The fake `PhysicsWorld`; comparing only the final state; cross-browser runs | Physics bodies (M2-3) get determinism coverage automatically; periodic snapshots show *when* runs diverge, not just that they did | Rapier's WASM must load in tests (~30 ms); cross-engine drift (T-33) is not tested | Networked play or cross-browser replays | Active |

## Process and docs

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-27 | Branch per task, fast-forward merged to `main` by Claude, no PRs or branch protection (M0; updated M0-7, M1) | A PR per task with required CI checks | Solo project; review happens in conversation before merge. Since M0-7, CI runs on every pushed branch, and Claude waits for green before merging. Since M1, the branch is deleted (remote and local) after merging; task IDs in commit messages keep the history traceable. GitHub's auto-delete only works for PR merges, so deletion is a manual step | A red `main` is still possible if someone merges without waiting | Collaborators join, or a red `main` happens | Active |
| T-28 | `docs/dev-log.md` + this register, no `CHANGELOG.md` (M0) | A changelog | No releases or outside players; a changelog would duplicate `git log` | — | First shareable build (M7) | Active |
| T-29 | GitHub Actions pinned to commit SHAs (M0-7) | Version tags (`@v7`) | A tag can be moved to different code; a SHA can't (supply-chain safety, like T-02) | Updates are manual; no Dependabot | Updating pins becomes a chore → add Dependabot for actions | Active |
| T-30 | One sequential CI job (lint → format → typecheck → test → build) (M0-7) | Parallel jobs per check | Simple; the whole run takes about a minute; one `npm ci` | First failure hides later ones (e.g., a lint error skips tests) | CI takes more than ~5 minutes | Active |
| T-31 | CI runs on every branch push, not only `main` / PRs (M0-7) | `main` + PRs only | There are no PRs (T-27), so branch runs are the only check before merge | Uses more Actions minutes (free for public repos) | PRs are introduced | Active |
