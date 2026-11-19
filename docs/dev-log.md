# Dev Log

_Hardpoint. What each task built, the problems hit and how they were resolved, plus what's owed. Trade-offs live in [`tradeoffs.md`](tradeoffs.md) (cited here by ID); big, hard-to-reverse decisions go in [`adr/`](adr/)._

**How to use:** add one entry per task (newest first) as part of the definition of done. Update the two lists below whenever an item is added or resolved; move resolved follow-ups into the entry that resolved them.

---

## Open follow-ups
Debt taken on deliberately, each with the condition that clears it.

| Item | Trade-off | Clear when | From |
|---|---|---|---|
| TypeScript pinned to 6.0.x (7.x is out) | T-01 | typescript-eslint supports TS 7 | M0-1 |
| `ARENA_SIZE` constant and debug grid in `Renderer` | T-20 | M2-4: build the floor from `ArenaDef`; keep the grid only behind a debug toggle | M0-3 |
| `SliceCamera` angle/distance are first guesses | T-19 | M2-5: tune with a real tank on screen, then record values in the GDD | M0-3 |
| `PhysicsWorld` only has `step` / `dispose`; physics behavior untested | T-24, T-16 | M2-3: add bodies, colliders, ray and shape casts, with tests | M0-4 |
| `main.ts` creates a physics world directly (smoke check) | T-26 | M1-5: `Simulation` owns the physics world | M0-4 |
| Bundle ~9.7 MB (2.7 MB gzip) | T-17, T-23 | Only if load time matters: Babylon per-module imports, non-compat Rapier | M0-3, M0-4 |
| Placeholder `index.ts` files in empty `src/` folders | T-12 | Delete each when its folder gets a real module | M0-2 |
| No `CHANGELOG.md` | T-28 | First shareable build (slice sign-off, M7) | M0 |

## Known environment issues
Workarounds for Brendan's machine and Claude Code's sandbox, so they aren't rediscovered.

| Issue | Workaround |
|---|---|
| In the Claude Code sandbox, npm fails with "cache contains root-owned files" (EPERM). The message is misleading: the sandbox blocks `~/.npm`; no files are root-owned | Run npm with `npm_config_cache="$TMPDIR/npm-cache"`. Do not `sudo chown` |
| Dev server in the sandbox fails with `listen EPERM` | Fixed: `sandbox.network.allowLocalBinding: true` in `.claude/settings.local.json` (gitignored) |
| Headless Chrome (used for screenshot/console checks) can't start in the sandbox | Run just that command outside the sandbox; stop the dev server by its PID |
| `gh` can't read the macOS keychain from the sandbox | Run `gh` commands outside the sandbox. `gh auth status` works in a normal terminal |
| Git commands that write `.git/config` (`push -u`, `branch -D`) warn "could not lock config file" in the sandbox | The main action still succeeds. Run `git branch --set-upstream-to=origin/<branch>` in a normal terminal if tracking is needed |
| npm 11 skips `fsevents`'s install script (asks for approval) | Harmless: the prebuilt binary works. Optional: `npm install-scripts approve fsevents`. Review any newly flagged package before approving |
| Local Node must be ≥ 22.12 (Vite); CI uses `.nvmrc` | Brendan upgraded Homebrew Node 23 → 26 (Active LTS). An old Node 20 install in `/usr/local/bin` (pkg installer) may shadow Homebrew in some tools; removal recommended |

---

## Entries

## 2026-11-19 · M0-7 · GitHub Actions CI
**Built:** `.github/workflows/ci.yml`: on every push and PR, `npm ci` → lint → format check → typecheck → test → build, on Node from `.nvmrc` with npm cache. Read-only token, superseded runs cancelled, 15-minute timeout.
**Trade-offs:** T-29, T-30, T-31; T-27 updated (CI now runs before merge).
**Acceptance:**
- First run on `m0-7-ci` green (all steps passed).
- Deliberate violation: a throwaway branch added `Math.random()` to `src/sim/core/index.ts`. CI failed at **Lint** with `'Math.random' is restricted… Use the simulation Rng (ADR-0001)`; later steps were skipped. The branch was deleted locally and on GitHub; the red run remains in Actions history as evidence.
**Issues:** the GitHub REST API returned an empty response (likely the unauthenticated rate limit) when resolving action SHAs → used `git ls-remote` instead.

## 2026-11-19 · M0 · Trade-offs register
**Built:** [`tradeoffs.md`](tradeoffs.md) with T-01 to T-28, backfilled from M0 so far, including three trade-offs that were mentioned in conversation but never recorded (T-10, T-15, T-27). Dev-log entries now cite IDs instead of repeating trade-off text.

## 2026-11-19 · M0 · Dev log created
**Built:** this file, backfilled for M0-1 to M0-4 from commits and the planning conversation. CLAUDE.md definition of done requires an entry per task.
**Trade-offs:** T-28.

## 2026-11-19 · M0-4 · Rapier 2D behind `PhysicsWorld`
**Built:** `PhysicsWorld` interface (`step`, `dispose`), `RapierPhysicsWorld` (async `create()` loads WASM once, zero-gravity world), 3 tests. `main.ts` loads physics before rendering. [ADR-0005](adr/0005-rapier-2d-physics.md) supersedes ADR-0002's physics row.
**Spike:** `rapier2d-compat` and `rapier3d-compat` 0.21.0 both load in Node (~32 ms) and pass a box-on-floor check. Bundle: 3.4 MB vs 4.3 MB. Size was not the deciding factor.
**Trade-offs:** T-16, T-21, T-22, T-23, T-24, T-25, T-26.
**Issues:** headless Chrome can't run in the sandbox → ran the browser check outside it. Verified `Physics ready: Rapier 2D` in the page console.

## 2026-11-18 · M0-3 · Babylon renders the arena floor
**Built:** `Renderer` (engine, scene, lights, 46×46 floor, 2 u debug grid), `SliceCamera` (fixed high angle looking +z), `main.ts` frame loop and resize.
**Trade-offs:** T-03, T-17, T-18, T-19, T-20, T-21.
**Issues:** `allowLocalBinding` wasn't in any settings file, so the dev server still couldn't bind in the sandbox. Brendan added it to `.claude/settings.local.json`; it briefly lived in a committed `settings.json` (harmless, still in history at `8f4bf35`).

## 2026-11-18 · M0-2 · Folder structure
**Built:** every folder from `architecture.md` §2 with a placeholder `index.ts` (`export {};` plus a one-line description). New no-barrel-files convention in CLAUDE.md.
**Trade-offs:** T-12, T-15.

## 2026-11-18 · M0-5 · Vitest
**Built:** `vitest.config.ts` (Node environment), `tests/sim/environment.test.ts` (no browser globals in sim tests), `tests/tooling/lintBoundaries.test.ts`: each of 11 sim-boundary violations is rejected in `src/sim` and allowed in `src/render`; Rapier and sibling sim imports stay allowed; default exports rejected everywhere. Scripts `test`, `test:watch`.
**Trade-offs:** T-05, T-13, T-14.
**Issues:**
- Verified the guard by deleting two rules from `eslint.config.js`: exactly those tests failed.
- Watch mode didn't rerun when Brendan edited `eslint.config.js`: the test reads it through ESLint at runtime, not via an import. Fixed with `forceRerunTriggers` (`84cc1fe`). ESLint itself reloads the config by mtime, so no cache issue.

## 2026-11-18 · M0-6 · ESLint + Prettier, simulation boundary
**Built:** flat `eslint.config.js`: type-aware typescript-eslint rules, no `any`, explicit module boundary types, `import type`, `===`, named exports only (config files exempt). `src/sim/**` block bans `@babylonjs/*`, imports into `render|input|ui|app` (including `import type`), `Math.random`, `Date.now`, `performance.now`, `new Date()`, browser globals and real timers. Every message cites its ADR. Prettier (single quotes, trailing commas, width 100). `.nvmrc` → 26.
**Trade-offs:** T-08, T-09, T-10, T-11.
**Issues:** manual check: 9/9 deliberate violations in a temporary `src/sim` file failed lint; the same code in `src/render` passed.

## 2026-11-18 · M0-1 · Vite + strict TypeScript
**Built:** `package.json` (`dev`, `build` = typecheck + vite build, `preview`, `typecheck`), `tsconfig.json`, `vite.config.ts`, `index.html` (full-window canvas), `src/app/main.ts`, `.nvmrc`, `.npmrc` (`save-exact`, `engine-strict`), `.gitignore`.
**Trade-offs:** T-01, T-02, T-04, T-06, T-07.
**Issues:**
- npm cache EPERM in the sandbox (see environment issues).
- `engines` was `>=24` with `engine-strict`, which would block Node 23 installs; relaxed to `>=22.12` (Vite's minimum). Brendan then upgraded to Node 26.
- **Correction:** the plan said "Node 24 LTS". Checked nodejs.org: Node 26 became Active LTS in October 2026 and 24 is in maintenance, so `.nvmrc` = 26.
