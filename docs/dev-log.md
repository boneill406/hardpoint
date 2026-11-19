# Dev Log

_Hardpoint. Smaller decisions, trade-offs, problems hit and what's owed. Big, hard-to-reverse decisions go in `docs/adr/` instead; this log links to them._

**How to use:** add one entry per task (newest first) as part of the definition of done. Update the two lists below whenever an item is added or resolved; move resolved follow-ups into the entry that resolved them.

---

## Open follow-ups
Debt taken on deliberately, each with the condition that clears it.

| Item | Why it exists | Clear when | From |
|---|---|---|---|
| TypeScript pinned to 6.0.x (7.x is out) | typescript-eslint supports TS `<6.1` only; type-aware lint needs it | typescript-eslint supports TS 7 | M0-1 |
| `ARENA_SIZE` constant and debug grid in `Renderer` | No `ArenaDef` yet | M2-4: build the floor from `ArenaDef`; keep the grid only behind a debug toggle | M0-3 |
| `SliceCamera` angle/distance are first guesses (58°, 34 u, FOV 0.75) | GDD gives no numbers | M2-5: tune with a real tank on screen, then record values in the GDD | M0-3 |
| `PhysicsWorld` only has `step` / `dispose` | Bodies and queries were not needed yet | M2-3: add bodies, colliders, ray and shape casts | M0-4 |
| `main.ts` creates a physics world directly (smoke check) | No `Simulation` yet | M1-5: `Simulation` owns the physics world | M0-4 |
| Bundle ~9.7 MB (2.7 MB gzip): full Babylon import + Rapier with embedded WASM | Simplicity; ADR-0002 accepts size | Only if load time matters: Babylon per-module imports, non-compat Rapier (ADR-0005) | M0-3, M0-4 |
| Placeholder `index.ts` files in empty `src/` folders | Git doesn't track empty folders | Delete each when its folder gets a real module (CLAUDE.md) | M0-2 |
| No `CHANGELOG.md` | No releases or outside players yet; would duplicate `git log` | First shareable build (slice sign-off, M7) | M0 |

## Known environment issues
Workarounds for Brendan's machine and Claude Code's sandbox, so they aren't rediscovered.

| Issue | Workaround |
|---|---|
| In the Claude Code sandbox, npm fails with "cache contains root-owned files" (EPERM). The message is misleading: the sandbox blocks `~/.npm`; no files are root-owned | Run npm with `npm_config_cache="$TMPDIR/npm-cache"`. Do not `sudo chown` |
| Dev server in the sandbox fails with `listen EPERM` | Fixed: `sandbox.network.allowLocalBinding: true` in `.claude/settings.local.json` (gitignored) |
| Headless Chrome (used for screenshot/console checks) can't start in the sandbox | Run just that command outside the sandbox; stop the dev server by its PID |
| `gh` can't read the macOS keychain from the sandbox | Run `gh` commands outside the sandbox. `gh auth status` works in a normal terminal |
| `git push -u` can't write upstream tracking to `.git/config` from the sandbox | Push succeeds; run `git branch --set-upstream-to=origin/<branch>` in a normal terminal if needed |
| npm 11 skips `fsevents`'s install script (asks for approval) | Harmless: the prebuilt binary works. Optional: `npm install-scripts approve fsevents`. Review any newly flagged package before approving |
| Local Node must be ≥ 22.12 (Vite); CI uses `.nvmrc` | Brendan upgraded Homebrew Node 23 → 26 (Active LTS). An old Node 20 install in `/usr/local/bin` (pkg installer) may shadow Homebrew in some tools; removal recommended |

---

## Entries

## 2026-11-19 · M0 · Dev log created
**Built:** this file, backfilled for M0-1 to M0-4 from commits and the planning conversation. CLAUDE.md definition of done now requires an entry per task.
**Trade-offs:** dev log instead of a CHANGELOG: there are no releases or outside users yet (see follow-ups).

## 2026-11-19 · M0-4 · Rapier 2D behind `PhysicsWorld`
**Built:** `PhysicsWorld` interface (`step`, `dispose`), `RapierPhysicsWorld` (async `create()` loads WASM once, zero-gravity world), 3 tests. `main.ts` loads physics before rendering. [ADR-0005](adr/0005-rapier-2d-physics.md) supersedes ADR-0002's physics row.
**Spike:** `rapier2d-compat` and `rapier3d-compat` 0.21.0 both load in Node (~32 ms) and pass a box-on-floor check. Bundle: 3.4 MB vs 4.3 MB. Chose 2D because the sim is planar (`Vec2` + heading): no axis locking or `Vec3` conversion. Size was not the deciding factor.
**Trade-offs:**
- `-compat` build embeds WASM in JS (bigger) so browser and Vitest load it the same way, with no Vite WASM plugin.
- Interface kept minimal until M2-3 to avoid guessing the body/query API.
- Private constructor + async factory: a world can't exist before WASM loads.
- Vite chunk warning raised to 10.5 MB (just above Babylon + Rapier) so real growth still warns.
**Issues:** headless Chrome can't run in the sandbox → ran the browser check outside it. Verified `Physics ready: Rapier 2D` in the page console.

## 2026-11-18 · M0-3 · Babylon renders the arena floor
**Built:** `Renderer` (engine, scene, lights, 46×46 floor, 2 u debug grid), `SliceCamera` (fixed high angle looking +z), `main.ts` frame loop and resize.
**Trade-offs:**
- Babylon pinned to **9.34.0**, not the latest 9.37.1 (released that day). Babylon ships weekly; a two-week-old release has had time to surface regressions or supply-chain problems. Policy: avoid days-old dependency versions.
- Import from the `@babylonjs/core` root, not per-module "pure" files, which need manual side-effect registration (missing shaders otherwise). Cost: ~6.3 MB bundle.
- `main.ts` owns the frame loop (`requestAnimationFrame`), not `engine.runRenderLoop`, so the M1 fixed-step sim slots in without restructuring.
- Narrow FOV (0.75 rad) to reduce perspective distortion at a high angle.
**Issues:** `allowLocalBinding` wasn't in any settings file, so the dev server still couldn't bind in the sandbox. Brendan added it to `.claude/settings.local.json`; it briefly lived in a committed `settings.json` (harmless, still in history at `8f4bf35`).

## 2026-11-18 · M0-2 · Folder structure
**Built:** every folder from `architecture.md` §2 with a placeholder `index.ts` (`export {};` plus a one-line description).
**Trade-offs:** new **no barrel files** convention (CLAUDE.md): import modules directly. Barrels invite circular imports (`Vehicle` ↔ `combat`) and hide where a class lives. Placeholders are deleted when a folder gets its first real file.

## 2026-11-18 · M0-5 · Vitest
**Built:** `vitest.config.ts` (Node environment), `tests/sim/environment.test.ts` (no browser globals in sim tests), `tests/tooling/lintBoundaries.test.ts`: each of 11 sim-boundary violations is rejected in `src/sim` and allowed in `src/render`; Rapier and sibling sim imports stay allowed; default exports rejected everywhere. Scripts `test`, `test:watch`.
**Trade-offs:**
- Lint snippets use non-existent paths, so type-aware parsing is off in that test and `ruleFilter` runs only the four boundary rules (they don't need type info).
- `@types/node` not added: the one use of `process.cwd()` was unnecessary (ESLint defaults to it). Add when tool code needs Node APIs.
**Issues:**
- Verified the guard by deleting two rules from `eslint.config.js`: exactly those tests failed.
- Watch mode didn't rerun when Brendan edited `eslint.config.js`: the test reads it through ESLint at runtime, not via an import. Fixed with `forceRerunTriggers` (`84cc1fe`). ESLint itself reloads the config by mtime, so no cache issue.

## 2026-11-18 · M0-6 · ESLint + Prettier, simulation boundary
**Built:** flat `eslint.config.js`: type-aware typescript-eslint rules, no `any`, explicit module boundary types, `import type`, `===`, named exports only (config files exempt). `src/sim/**` block bans `@babylonjs/*`, imports into `render|input|ui|app` (including `import type`), `Math.random`, `Date.now`, `performance.now`, `new Date()`, browser globals and real timers. Every message cites its ADR. Prettier (single quotes, trailing commas, width 100). `.nvmrc` → 26.
**Trade-offs:**
- ESLint's built-in `no-restricted-*` rules instead of a plugin (e.g., `eslint-plugin-boundaries`): one less dependency. Revisit if layer rules get more complex.
- Prettier skips `*.md`: it would pad every table into aligned columns, making each small doc edit a whole-table diff.
- `no-restricted-syntax` is repeated in the sim block because flat config replaces a rule's options per block instead of merging them.
**Issues:** manual check: 9/9 deliberate violations in a temporary `src/sim` file failed lint; the same code in `src/render` passed.

## 2026-11-18 · M0-1 · Vite + strict TypeScript
**Built:** `package.json` (`dev`, `build` = typecheck + vite build, `preview`, `typecheck`), `tsconfig.json`, `vite.config.ts`, `index.html` (full-window canvas), `src/app/main.ts`, `.nvmrc`, `.npmrc` (`save-exact`, `engine-strict`), `.gitignore`.
**Trade-offs:**
- **TypeScript 6.0.3, not 7.x:** typescript-eslint requires `<6.1` (see follow-ups).
- Extra strictness beyond `strict`: `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, unused locals and params.
- Exact dependency pins (the prototype suffered from unpinned CDN versions).
- `test`, `lint` and `format` scripts were added with their tools (M0-5, M0-6) rather than as failing stubs.
**Issues:**
- npm cache EPERM in the sandbox (see environment issues).
- `engines` was `>=24` with `engine-strict`, which would block Node 23 installs; relaxed to `>=22.12` (Vite's minimum). Brendan then upgraded to Node 26.
- **Correction:** the plan said "Node 24 LTS". Checked nodejs.org: Node 26 became Active LTS in October 2026 and 24 is in maintenance, so `.nvmrc` = 26.
