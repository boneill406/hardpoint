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
| T-26 | `main.ts` creates a physics world directly as a smoke check (M0-4) | Waiting for `Simulation` | Proves Rapier loads in the browser in M0 | App wiring touches a sim internal | M1-5 (`Simulation` owns physics) | Temporary |

## Process and docs

| ID | Decision (task) | Instead of | Why | Cost / risk | Revisit when | Status |
|---|---|---|---|---|---|---|
| T-27 | Branch per task, fast-forward merged to `main` by Claude, no PRs (M0) | A PR per task | Solo project; review happens in conversation before merge | No PR history or CI gate before merge (CI runs after push) | CI is set up (M0-7), or collaborators join | Active |
| T-28 | `docs/dev-log.md` + this register, no `CHANGELOG.md` (M0) | A changelog | No releases or outside players; a changelog would duplicate `git log` | — | First shareable build (M7) | Active |
