# Milestones & Backlog — Vertical Slice

_Hardpoint (working title). Created 2026-11-18._

**Budget assumption:** ~4 hours/week → each milestone is ~8 hours (~2 weeks). The slice is **8 milestones ≈ 16 weeks**. Estimates are rough; M2–M4 carry the most risk.

**Rules**
- A milestone is done only when its **Done when** list is met and CI is green.
- Every milestone ends with something you can run or test.
- New ideas go to the **Post-slice backlog**, not into the current milestone. Check against the GDD's out-of-scope list (`gdd.md` §10).
- Task IDs (e.g., `M2-3`) are for commit messages and branch names.

---

## M0 — Project scaffold
**Goal:** an empty but correctly structured project where CI enforces the architecture rules.

| ID | Task |
|---|---|
| M0-1 | Vite + TypeScript (strict) project; `npm run dev / build / test / lint / typecheck / format` scripts |
| M0-2 | Folder structure from `architecture.md` §2 with placeholder `index.ts` files |
| M0-3 | Babylon.js renders a blank scene with a ground plane and the slice camera angle |
| M0-4 | Rapier initializes (async WASM load) behind the `PhysicsWorld` interface. **Decide `rapier2d` vs `rapier3d`** (gameplay is planar; see note below) and record the outcome in ADR-0002 or a new ADR |
| M0-5 | Vitest configured; one passing sample test in `tests/sim/` |
| M0-6 | ESLint + Prettier. Import-boundary rule (`src/sim` can't import render/input/ui/app/`@babylonjs/*`); ban `Math.random`/`Date.now` in `src/sim` |
| M0-7 | GitHub Actions workflow: install → lint → typecheck → test → build on push and PR |
| M0-8 | `README.md`: what the project is, how to run it, link to `docs/` |

**Done when:** `npm run dev` shows the blank scene; CI is green; a deliberate boundary violation fails lint.

> **Note on M0-4:** all slice gameplay happens on the ground plane. `rapier2d` is simpler and lighter, but `rapier3d` keeps the door open for ramps or height later. Decide during M0 with a quick spike.

## M1 — Simulation core
**Goal:** the fixed-step engine room, fully tested, with a debug view.

| ID | Task |
|---|---|
| M1-1 | Math types for the simulation (`Vec2` ground plane, angles in radians, helpers) |
| M1-2 | `FixedClock` (60 Hz accumulator, max catch-up steps) |
| M1-3 | `Rng` (seeded, e.g., mulberry32) |
| M1-4 | `EventBus` with typed events |
| M1-5 | `Entity`, `World` (add/remove/get/ofType), `Simulation.tick(commands)` |
| M1-6 | `RenderBridge` skeleton: view per entity id, interpolation between ticks, coordinate conversion in one place (`render/coords.ts`) |
| M1-7 | Determinism test: same seed + command stream → identical state |

**Done when:** a test entity moves at a fixed speed and renders smoothly at any frame rate; all core classes have tests.

## M2 — Driving
**Goal:** driving around the arena feels at least as good as the prototype.

| ID | Task |
|---|---|
| M2-1 | `Vehicle`, `Locomotion` interface, `TrackedLocomotion` (GDD §3 values) |
| M2-2 | `PlayerIntent`, `KeyboardMouseDevice`, `GamepadDevice` (Xbox, tank-style), `PlayerController` |
| M2-3 | Collision: oriented box hull vs. walls/pillars/crates via `PhysicsWorld` |
| M2-4 | Arena definition (`defs/arenas.ts`): 46×46 walls, pillars, crates, 3 gates, player start |
| M2-5 | Camera: high angle, smoothed follow |
| M2-6 | Primitive tank view (hull, tracks, turret) |

**Done when:** you can drive with keyboard and Xbox controller; treads never visibly enter obstacles; locomotion is unit-tested.

## M3 — Turret, weapons, damage
**Goal:** shoot things, and directional armor works.

| ID | Task |
|---|---|
| M3-1 | `Turret` traverse with spin-up delay; mouse ray / right-stick aiming |
| M3-2 | `Weapon` with `FireLimiter[]`; `ReloadLimiter`, `HeatLimiter` |
| M3-3 | `Projectile` with swept collision (no tunneling, no hits in empty space) |
| M3-4 | `ArmorProfile` (front/side/rear by hit angle), `Health`, `DamageResolver` |
| M3-5 | Destructible crates (cannon only); static enemy-tank target dummy |
| M3-6 | HUD: armor, reload, heat bars |

**Done when:** front hits on the dummy visibly deal less than rear hits; the machine gun overheats and re-arms; tests cover armor angles and multi-limiter weapons.

## M4 — Enemy AI
**Goal:** one insurgent tank that hunts you competently.

| ID | Task |
|---|---|
| M4-1 | Defs + `VehicleFactory`; insurgent def (GDD §5) |
| M4-2 | Grid A* `Pathfinder` (navigation grid built from the arena; rebuilt when crates break) |
| M4-3 | Line-of-sight checks |
| M4-4 | `AiController` state machine: Advance / Engage / Reposition; keeps front armor toward the player |
| M4-5 | Fire telegraph event (~0.3 s), aim spread |
| M4-6 | Friendly fire + "hold fire if an ally blocks the shot" check |

**Done when:** an enemy paths around cover, engages, repositions when blocked, and never gets permanently stuck; pathfinding and state transitions are tested.

## M5 — Waves and run loop
**Goal:** a complete, replayable run without refreshing the page.

| ID | Task |
|---|---|
| M5-1 | `GameMode` interface, `WaveSurvivalMode`, wave defs (1→5 tanks) |
| M5-2 | Spawn gates: staggered spawns, warning glow, events |
| M5-3 | Breather: countdown, +20% max armor repair |
| M5-4 | Game states: title → playing → paused → summary → restart/title |
| M5-5 | Run stats + summary screen (waves, time, kills, accuracy per weapon, damage taken) |
| M5-6 | HUD: wave counter, enemies remaining, countdown; off-screen enemy and gate indicators |

**Done when:** a full win and a full loss are both playable start to finish with keyboard and controller; wave logic is tested.

## M6 — Feel and effects ("juice")
**Goal:** hits feel heavy and the screen stays readable.

| ID | Task |
|---|---|
| M6-1 | Screen shake, hit-stop, hit flash |
| M6-2 | Muzzle flash light, cannon recoil |
| M6-3 | Explosions and smoke via Babylon particle presets / Node Particle Editor assets |
| M6-4 | Crate break-apart chunks; tread marks; MG heat glow |
| M6-5 | Bloom and basic post-processing |
| M6-6 | Placeholder sound effects (cannon, MG, impact, explosion, wave start/clear) |

**Done when:** every GDD §8 item is in; effects never hide projectiles or enemies.

## M7 — Tuning and slice sign-off
**Goal:** the slice meets every GDD acceptance criterion.

| ID | Task |
|---|---|
| M7-1 | Playtest sessions; record notes in `docs/playtests.md` |
| M7-2 | Balance pass on defs (speeds, damage, waves, crate count) |
| M7-3 | Performance check: 60 fps with wave 5 on screen (M1 MacBook Air) |
| M7-4 | Bug bash; collision edge cases |
| M7-5 | Walk the GDD §11 checklist; write `docs/slice-retro.md` |

**Done when:** every acceptance criterion in `gdd.md` §11 is checked, including the fun test.

---

## Post-slice backlog (unordered, not committed)
- ADR: asset pipeline (Blender → glTF) and Blender-authored arenas
- Walker chassis: `LeggedLocomotion` + procedural `LegRig` (2-bone IK, foot planting)
- Garage / meta loop, credits, upgrades, weapon tiers
- Custom tank builds: split `VehicleDef` into part defs (chassis, engine, turret, weapons, armor); a pure `resolveBuild(build, parts) → VehicleDef` so `Vehicle` and the factory stay unchanged. Engines state power and acceleration is derived from power ÷ total mass (replaces `accelTime`), so heavier loadouts get slower (the parked mass/power budget idea). Builds are ids as JSON (save data, co-op sync)
- Multiple player chassis and insurgent variants: more defs keyed by id (`VEHICLES`), referenced by waves and a chassis-select screen; new code only for new behaviour
- `AmmoLimiter` and resupply
- Machine gun pushes light crates (physics-driven cover)
- Room-clearing mode (Robokill-style)
- Co-op: couch first, then LAN (networking ADR)
- More enemy types (infantry, technicals), aliens faction
- Settings, key rebinding, save data, music
- Crate rebuild between waves (revisit after playtests)
