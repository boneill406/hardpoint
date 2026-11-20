# Dev Log

_Hardpoint. What each task built, the problems hit and how they were resolved, plus what's owed. Trade-offs live in [`tradeoffs.md`](tradeoffs.md) (cited here by ID); big, hard-to-reverse decisions go in [`adr/`](adr/)._

**How to use:** add one entry per task (newest first) as part of the definition of done. Update the two lists below whenever an item is added or resolved; move resolved follow-ups into the entry that resolved them.

---

## Open follow-ups
Debt taken on deliberately, each with the condition that clears it.

| Item | Trade-off | Clear when | From |
|---|---|---|---|
| TypeScript pinned to 6.0.x (7.x is out) | T-01 | typescript-eslint supports TS 7 | M0-1 |
| `SliceCamera` angle/distance are first guesses | T-19 | M2-5: tune with a real tank on screen, then record values in the GDD | M0-3 |
| Bundle ~9.7 MB (2.7 MB gzip) | T-17, T-23 | Only if load time matters: Babylon per-module imports, non-compat Rapier | M0-3, M0-4 |
| Placeholder `index.ts` files in empty `src/` folders | T-12 | Delete each when its folder gets a real module | M0-2 |
| `VehicleSnapshot` has transform + velocities only | — | M3: add health, heat and reload state so determinism checks cover them | M1-5, M2-1 |
| Circling insurgent in the `main.ts` debug scene | T-49 | M4: real enemies | M1-6, M2-2, M2-4 |
| Barrel pokes into walls and pillars (T-75) | T-75 | M3-7: muzzle ray (sim) sets shell spawn and barrel retraction (view) | M2-6 |
| Playtest: drive with keyboard and Xbox pad; pick a `?pad=` scheme; judge reverse steering (T-53) and handling values | T-53 | Brendan's feedback; values go to `defs/vehicles.ts` and GDD §3 | M2-2 |
| No `CHANGELOG.md` | T-28 | First shareable build (slice sign-off, M7) | M0 |

## Known environment issues
Workarounds for Brendan's machine and Claude Code's sandbox, so they aren't rediscovered.

| Issue | Workaround |
|---|---|
| In the Claude Code sandbox, npm fails with "cache contains root-owned files" (EPERM). The message is misleading: the sandbox blocks `~/.npm`; no files are root-owned | Run npm with `npm_config_cache="$TMPDIR/npm-cache"`. Do not `sudo chown` |
| Dev server in the sandbox fails with `listen EPERM` | Fixed: `sandbox.network.allowLocalBinding: true` in `.claude/settings.local.json` (gitignored) |
| Headless Chrome (used for screenshot/console checks) can't start in the sandbox | Run just that command outside the sandbox. Use `--use-angle=swiftshader --enable-unsafe-swiftshader` (software WebGL); `--disable-gpu` makes Babylon fail with "WebGL not supported" |
| A dev/preview server started in the background can't be stopped from inside the sandbox (`kill`: operation not permitted) | Stop it by PID outside the sandbox. `$TMPDIR` differs inside and outside the sandbox, so don't rely on a PID file across the two |
| `gh` can't read the macOS keychain from the sandbox | Run `gh` commands outside the sandbox. `gh auth status` works in a normal terminal |
| Git commands that write `.git/config` (`push -u`, `branch -D`) warn "could not lock config file" in the sandbox | The main action still succeeds. Run `git branch --set-upstream-to=origin/<branch>` in a normal terminal if tracking is needed |
| npm 11 skips `fsevents`'s install script (asks for approval) | Harmless: the prebuilt binary works. Optional: `npm install-scripts approve fsevents`. Review any newly flagged package before approving |
| Local Node must be ≥ 22.12 (Vite); CI uses `.nvmrc` | Brendan upgraded Homebrew Node 23 → 26 (Active LTS). An old Node 20 install in `/usr/local/bin` (pkg installer) may shadow Homebrew in some tools; removal recommended |

---

## Entries

## 2026-11-20 · M2-5 follow-up · Camera framing fixed; slice camera chosen
**Why:** Brendan picked `?cam=slice` (narrowly over `proto`) and noticed the bottom-left and bottom-right corners never came into view and the top wall sat slightly outside it.
**Cause:** a tilted camera sees a trapezoid (at 16:10: ±17 u wide at the bottom edge, ±28 u at the top). The clamp used the widest part, which is wider than the arena (±24 u), so it centred the camera horizontally and it never moved sideways; and it clamped where the screen edge met the *floor*, while 2 u tall walls show their top edge further up the screen.
**Changed:** `SliceCamera` clamps sideways by the bottom edge's half-width and up/down where the screen edges cross wall-top height (`Renderer.screenToPlane`); `ArenaView` adds a 300 u terrain plane beyond the walls so the wider top of the view shows ground, not void. GDD §7 records the slice values (T-19 reversed); T-78 revised.
**Acceptance:** temporary builds starting the player at the bottom-right corner and at the top (reverted): the corner and the whole top wall, including its top edge and corners, are on screen; terrain shows past the right wall.
**Resolved:** camera preset pick follow-up.

## 2026-11-20 · M2-5 · Camera follow and framing
**Built:** `SliceCamera` rewritten: `CameraPreset` (elevation, distance, FOV) with two presets, `slice` (the M0-3 guess) and `proto` (the prototype's `game.js` camera: offset (0, 23, 3.2) → ≈82°, 23.2 u; 38° FOV), chosen with `?cam=`. The focus eases toward the followed tank's drawn position at the prototype's rate (`1 − e^(−3.2·dt)`, frame-rate independent; first frame snaps) and is clamped so the visible ground patch stays inside the arena and walls (measured by casting the four screen corners to the floor; re-measured on resize; centred if the view is larger than the arena on an axis). `Renderer` builds bounds from the `Arena`. `debugParams` gains `cam` (validated, tested).
**Also:** M3-7 added to milestones (muzzle clearance ray + barrel retraction, from T-75).
**Trade-offs:** T-78, T-79; T-64 reversed; T-19 updated (resolved by the preset pick).
**Acceptance:** headless screenshots from the player start with both presets: bottom wall at the screen's bottom edge, no void, tank low on screen. `slice` shows most of the arena; `proto` shows tanks about twice the size and roughly a quarter of the arena. Easing needs a real screen.
**Observation for the pick:** GDD §7 assumes the arena is larger than one screen (off-screen indicators). With `slice` it nearly isn't; with `proto` it very much is.

## 2026-11-19 · M2-6 follow-up · Hull pitch toned down
**Why:** Brendan's playtest: tread direction and pivot treads correct; hull pitch "a bit bouncy, maybe slightly too much pitch".
**Changed:** `tankMotion.ts`: pitch per acceleration 0.003 → 0.002 rad per u/s² (≈2° at full throttle), cap 0.09 → 0.06 rad (≈3.4°), damping ratio 0.35 → 0.6 (overshoot ≈31% → ≈10%). Tests updated (cap, overshoot under 15%).
**Resolved:** tank-view playtest follow-up (tread direction, pivot). Barrel clipping (T-75) stays open with a proposed fix.

## 2026-11-19 · M2-6 · Primitive tank view
**Built:**
- `render/views/tank/TankModel.ts` (interface: root, hull pitch node, turret, barrel, two `TreadSurface`s) and `PrimitiveTankModel`: the prototype's design (`mantis_breach_v0_1_0/tank.js`, read-only reference) rebuilt in Babylon and slimmed so everything, tracks included, fits the 2.4 × 1.6 footprint (Brendan: keep a 1.5 length-to-width ratio). Tracks with rounded ends and a scrolling tread surface (0.4 u pads, `DynamicTexture`), hull with deck, sloped glacis, engine deck, vents and lamps, stretched hex turret with top plate, hatch and mantlet, barrel with muzzle brake and coaxial MG. Prototype palette for the player; sand and rust for insurgents.
- `render/views/tank/tankMotion.ts` (pure): `treadSpeeds` (left = forward + ω·d, right = forward − ω·d), `treadBlur` (fade once the pattern moves over ¼ period per frame), `pitchTarget` (≈3° at full acceleration, capped ≈5°), `stepPitchSpring` (3 Hz, damping 0.35: rocks once; sub-stepped so stalls can't explode it).
- `TankView` replaces `VehicleView`: places the model, accumulates per-track distance from the vehicle's post-physics velocities, pitches the hull from last tick's acceleration. `Vehicle.previousLinearVelocity` (saved with the transform). `EntityView.update` and `Renderer.render` now take the frame's seconds.
- Player turn rate 2.0 → 2.3 rad/s (Brendan's request; GDD §3).
- 13 new tests (246 total): `tankMotion` (12, `tests/render/`, T-77) and `previousLinearVelocity`.
**Prototype findings:** its treads used 0.19 u pads, which at full speed move ~0.6 of a pad per frame, the wagon-wheel effect that looked "way too fast"; `TREAD_SPEED_SCALE = 0.05` hid it but disconnected the treads from the motion. Unequal pivot speeds came from mixing the turn *input* (−1..1) with speeds and from any leftover forward speed. Both handled (T-74; pivot test).
**Trade-offs:** T-73, T-74, T-75, T-76, T-77.
**Acceptance:** headless close-ups (a temporary camera-distance build, reverted) show the model and five tread pads per track; normal view shows both factions. Scroll direction, pivot treads and pitch need driving → playtest follow-up.
**Issues:** first close-up showed one stretched band instead of repeating pads: `DynamicTexture` defaults to clamp addressing, so `vScale` stretched the edge; set wrap mode explicitly.

## 2026-11-19 · M2-3b · Tank vs. tank
**Built:**
- `MAX_VEHICLE_SPEED` (12 u/s) in `VehicleDef.ts`; `CONTACT_PREDICTION_DISTANCE` now derived from it for two capped tanks head-on (0.5 u). Def test: every top speed ≤ cap. Backlog note: `resolveBuild` must clamp.
- `PhysicsWorld.contacts()`: this step's pushing contacts `{ bodyA, bodyB, impulse }`. Rapier: vehicle colliders report contact force events (threshold 0), drained after each step; impulse = force × dt.
- `PhysicsBridge.newVehicleImpacts()`: maps bodies back to entities, keeps vehicle pairs only, and reports a pair only on the tick it starts touching (`a` < `b`). `Simulation` emits `VehiclesCollided { a, b, impulse }` (new in `SimEvents`).
- Insurgent grip 30 → 50 (GDD §5).
- Shared test helpers `tests/sim/physics/overlap.ts` (oriented-box overlap, tolerance, `seconds`).
- 15 new tests (233 total): speed-cap def test (2), `tankContacts.test.ts` (head-on at 11 u/s closing never overlaps; stronger wins head-on; weaker barely moves a parked stronger tank; side ram knocks ~1 u then stops; leaning creep matches T-71's formula; `VehiclesCollided` once per impact, again after separating, bigger for harder hits, not for walls), `PhysicsBridge` impact unit tests (3), determinism with six tanks hitting walls, cover and each other in `SLICE_ARENA`.
**Trade-offs:** T-71, T-72; T-66 updated.
**Acceptance:** worst tank-vs-tank overlap ~0.001 u. Planted bug (impacts not deduplicated): 3 tests failed; restored. Built game loads clean. Shoving needs Brendan's eyes.
**Issues:**
- Measured before tuning. With grip 30 a full-speed T-bone made the insurgent skate ~6 u: grip force (20 × 30 = 600) barely exceeded the player's engine (525), so the knock decelerated very slowly. Grip 50 cuts the knock to ~1 u.
- My estimate for grip 50 (0.9 u) first looked wrong (2.15 u after 4 s). A trace showed two effects: the knock (~0.9 u, as estimated) plus a steady 0.44 u/s creep while the player keeps pushing, identical at grip 50, 80 and 120. Cause: grip runs in locomotion between steps and can only zero sideways velocity; it can't resist inside the step like static friction, so the solver shares the pusher's engine impulse every tick. Kept (stronger tanks bulldozing weaker ones fits the design) and recorded as T-71; tests describe it instead of claiming the tracks hold.

## 2026-11-19 · M2-3a · Static collision
**Built:**
- `PhysicsWorld` extended (T-24): `addStaticBox`, `addVehicleBody` (hull box, mass), `setVelocity`, `readBody`, `removeBody`, all in sim coordinates. `RapierPhysicsWorld` implements it: fixed bodies for obstacles, dynamic bodies (no sleeping, zero friction with `Min` combine, no restitution) for vehicles; heading ↔ Rapier rotation is `r = −h` (and the same for angular velocity), in two functions.
- `PhysicsBridge` (sim): one body per vehicle and prop, diffing ids each tick; pushes vehicle velocities, pulls resolved state. `Simulation` adds walls as static boxes once and runs sync → push → step → pull. `Vehicle.integrate` replaced by `syncFromPhysics` (T-51 reversed).
- `debugParams` reports unknown names, invalid values, and `?` inside a value ("separate parameters with &, not ?"); `main.ts` logs them with `console.warn`.
- Tests (218 total, +23): `collision.test.ts` with real Rapier measures, **every tick, how deep the oriented hull overlaps any wall or prop** (separating-axis test): straight into a wall stops at the face; at 45° the corner reaches the wall (no invisible bubble); angled approach slides; flush against a wall it can still pivot; can't pass through a crate or pillar; 20 s of wild driving in `SLICE_ARENA` never leaves it or enters anything. Rapier adapter conventions (position/heading round-trip, +z velocity, clockwise angular velocity, removal, stale handle throws), `PhysicsBridge` (with `FakePhysicsWorld`, now a no-collision integrator, T-69), `syncFromPhysics`, a def guard (top speed per tick < prediction distance), `debugParams` (`tests/app/`, T-70).
**Resolved:** follow-up "`PhysicsWorld` only has step/dispose; physics behaviour untested" (T-16, T-24 reversed).
**Trade-offs:** T-66, T-67, T-68, T-69, T-70; T-16, T-24, T-51 reversed.
**Acceptance:** worst overlap across all scenarios 0.005 u (tolerance 0.02 u). Built game loads in headless Chrome; `?pad=triggers?grid=on` now logs the `&` hint. Driving into things needs Brendan's eyes.
**Issues:**
- First run: hitting a pillar at full speed overlapped 0.058 u. A per-tick trace showed a one-tick spike on impact (arriving at 7 u/s) that the solver pushed out over ~10 ticks. Cause: Rapier creates contacts only within its prediction distance (default 0.02 u), but a tank moves 0.12 u per tick. CCD made no difference; raising the prediction distance did (0.05 still failed; 0.15 and 0.3 passed). Set to 0.15 with a def test guarding top speed (T-66).
- Both tanks are dynamic bodies now, so they already collide; M2-3b tunes and tests the shove and adds the event.
- A `Write` was rejected because Prettier had reformatted the file since it was read, so tests ran against the old file; re-read and rewrote.

## 2026-11-19 · M2 · Plan update: M2-3 split, readability features
**Changed:** M2-3 split into **M2-3a** static collision and **M2-3b** tank vs. tank (plan, milestones.md), so the riskiest task lands in two reviewable, playable steps. A `debugParams` warning for unrecognised values joins M2-3a (Brendan typed `?pad=triggers?grid=on`, which silently fell back to `tank` and never set `grid`; the second parameter needs `&`).
**Added to GDD §7 and M6 (new M6-7):** occlusion silhouettes, the player's tank always and enemies only while the player has line of sight (cover still hides enemies, so flanking keeps its value); shadows from the sun light behind `?shadows=off`. Deliberately later than M2-6.

## 2026-11-19 · M2-4 · Arena definition
**Built:**
- `arena/ArenaDef.ts` (`ArenaDef`, `BoxDef`, `GateDef`) and `defs/arenas.ts`: `SLICE_ARENA`, 46 × 46, 1 u walls, player start (0, −19) facing up-screen, gates left/right/top, 7 pillars (centre 3 × 3, two 2 × 2, two long side and two long top segments), 14 crates (1.5 u), mirror-symmetric.
- `arena/Arena.ts` (four wall boxes from the size, corners overlapped; `contains`; `spawnProps` adds pillars then crates in def order) and `arena/Prop.ts` (entity: kind, size, destructible). `Simulation({ arena })` spawns props before `populate`.
- Render: `ArenaView` (floor, walls, gate panels, grid behind `?grid=on`), `PropView` (box sized to the footprint; pillars 2.5 u tall, crates 1.1 u). `RenderBridge` records drawn transforms; `Renderer.render(entities, alpha, followId)` hard-follows the player. `ARENA_SIZE` and the old grid removed (T-20 reversed).
- `main.ts`: player at `SLICE_ARENA.playerStart`; circling insurgent moved to open ground right of centre (radius ≈ 2.9 u). Deleted the `src/sim/arena/index.ts` placeholder (T-12).
- Post-slice backlog (milestones.md): custom tank builds via part defs + `resolveBuild`, engine power instead of `accelTime`; multiple chassis and insurgent variants by id (from Brendan's question about scaling defs).
- GDD §3/§5 and plan D3 updated with Brendan's tuned player handling (commit `e09165d`: 0.4 s accel, 0.25 s stop, 0.15 s shift, 2.0 rad/s).
- 12 new tests (195 total): layout invariants for `SLICE_ARENA` (GDD counts, obstacles inside with a tank-width lane to the walls and between each other, gates on walls facing in with a clear apron, player start clear, left/right mirror symmetry), `Arena` walls/contains/spawning, `Simulation` with and without an arena.
**Trade-offs:** T-62, T-63, T-64, T-65; T-20 reversed; T-49 updated.
**Acceptance:** headless screenshots of the built game: the arena from the player's start with walls, grey pillars, brown crates and the circling insurgent, with and without `?grid=on`. Planted a crate on the player start: the clearance test failed; reverted.
**Issues:** none.

## 2026-11-19 · M2-1 follow-up · Gear-change pause, heavier handling
**Why:** Brendan's first drive: forward → reverse felt "too smooth for a hefty mechanical machine". Braking and the reverse ramp blended into one continuous V through zero.
**Built:** `TrackedLocomotion` gearbox: asking for the opposite direction brakes to a stop (below 0.05 u/s), sits still for `shiftTime`, then engages and pulls away the same tick. Releasing the throttle doesn't shift, so stopping and pulling away the same way is immediate; selecting reverse from a standstill after driving forward does shift. New def field `shiftTime`; both tanks now 0.5 s to top speed, 0.15 s to stop, 0.2 s shift (GDD §3). `Locomotion.snapshot()` added; `VehicleSnapshot` includes it, so determinism checks cover the gear. Plan D3 revised; hull pitch moved from M6 into M2-6 (plan, GDD §8).
**Tests:** `TrackedLocomotion` tests rewritten around a stateful `Driver` helper (the old helper made a fresh instance per call, which would hide gear state); 6 new gearbox tests (forward→reverse pause length, reverse→forward, shift from standstill, no shift on release, no pause when easing off, `shiftTime` 0) and a snapshot test; the old "reversing brakes first" test is folded into them. 183 total (+6).
**Trade-offs:** T-60, T-61.
**Issues:** `Math.sign` returns `number`, not the `1 | -1` gear type; made explicit.

## 2026-11-19 · M2-2 · Input and `PlayerController` — first drivable build
**Built:**
- `input/PlayerIntent.ts` (`DriveIntent` tank | direct, `AimIntent` point | direction | none, `NO_INTENT`, `hasInput`), `input/bindings.ts` (keyboard codes, standard pad indices, `PAD_SCHEMES` tank / direct / triggers, deadzone, trigger threshold).
- Pure mappings: `keyboardIntent`, `gamepadIntent` + `radialDeadzone`, `intentToCommand` (stick aim → point 8 u out; `direct` → turn proportional to heading error, full at 30°, throttle × cos(error), pivot when the target is behind).
- Devices: `InputDevice` interface, `KeyboardMouseDevice` (DOM listeners via one `AbortController`; Space/arrows don't scroll; no context menu; releases keys on blur), `GamepadDevice` (polled), `InputManager` (last-active wins, logs device changes).
- `Renderer.screenToGround` (camera ray ∩ y = 0) and `coords.fromBabylonPosition`. `?pad=` in `debugParams` (own-key check: `in` would accept `toString`).
- `sim/vehicles/controllers/PlayerController` (its player's command, or idle).
- `main.ts`: player tank with `PlayerController`; per frame `input.read` → `intentToCommand` → one commands map for all of that frame's ticks. Insurgent still circles.
- Deleted the `src/input/index.ts` placeholder (T-12). Architecture §2/§7 and README updated.
- 32 new tests (177 total): keyboard (6), gamepad (10), `intentToCommand` (9), `InputManager` (3), `PlayerController` (2), determinism (2). Determinism now includes a player tank, plus "different command stream → different game" and "player drives by the stream".
**Resolved:** M1-7 follow-up (the determinism test's command stream now drives a player tank).
**Trade-offs:** T-55 to T-59; T-49 updated.
**Acceptance:** built game loads cleanly in headless Chrome with no `?pad`, `direct`, `triggers` and an invalid value (falls back to `tank`). Keyboard and Xbox driving can't be exercised headless → playtest follow-up for Brendan.
**Issues:** the first draft of the "player drives by the stream" test called the script generator, which would have advanced its RNG and compared a value with itself; rewritten to check the command isn't idle and the tank moved.

## 2026-11-19 · M2-1 · `Vehicle`, `TrackedLocomotion`, defs
**Built:**
- `vehicles/VehicleDef.ts` (`VehicleDef`, `HullDef`, `TrackedLocomotionDef` with a `kind` for future locomotion types) and `defs/vehicles.ts`: `PLAYER_TANK` (7 u/s, reverse ×0.6, 0.4 s to top speed, 0.25 s to stop, 2.2 rad/s with 0.1 s ramp, grip 40, mass 30, hull 2.4 × 1.6) and `INSURGENT_TANK` (GDD §5; mass 20, grip 30). GDD §3/§5 updated in the plan commit.
- `locomotion/Locomotion.ts` (interface: `step(command, motion, dt)` → velocities) and `TrackedLocomotion` (traction-limited: engine rate when speeding up, brake rate when slowing or reversing, grip cancels sideways slide, turn ramp; inputs clamped).
- `controllers/Controller.ts` (interface: `decide({ tick, commands, vehicle })`), `debug/ScriptedController`.
- `Vehicle` (def, faction, controller, locomotion; velocities; `applyCommand` / `drive` / `integrate`; `snapshot()` adds velocities), `VehicleFactory.createVehicle`, `Faction`, `IDLE_COMMAND`, `core/scalar.ts` (`clamp`, `approach`).
- `Simulation.tick` phases: save transforms → controllers decide → locomotion → integrate → physics → removals.
- Render: placeholder `VehicleView` sized to the hull footprint, coloured by faction. `main.ts` debug scene: player tank on a 5 s routine (forward with a gentle turn, coast, reverse, stop), insurgent circling.
- Deleted `DebugMover`, `DebugMoverView` and their test (T-41 reversed), plus three placeholders (`defs/`, `locomotion/`, `controllers/` `index.ts`, T-12).
- 31 new tests, 2 `DebugMover` tests removed (145 total): `TrackedLocomotion` (12), `Vehicle` + `createVehicle` (6), def invariants (8, incl. "grip holds a full-speed turn"), `scalar` (4), `Simulation` controller phase; `Simulation` and determinism tests ported to vehicles (determinism now flips tanks between forward and reverse).
**Trade-offs:** T-50, T-51, T-52, T-53, T-54; T-41 reversed; T-49 updated.
**Acceptance:** headless screenshot of the built game: green player tank turning gently right, orange insurgent circling left; console clean.
**Issues:** `Vehicle`'s private `current` clashed with `Entity`'s private `current` (TypeScript private names share one namespace across a class hierarchy); renamed to `activeCommand`.

## 2026-11-19 · M1 · Milestone complete
**Resolved:** visual-check follow-up from M1-6: Brendan confirmed the movers look smooth in `npm run dev`.
**M1 done-when:** a test entity moves at a fixed speed (`Simulation` test: speed × 1 s in 60 ticks) and renders smoothly at any frame rate (Brendan's check, plus `?fps` / `?interp=off` comparison) ✅ · all core classes have tests (`Vec2`, angles, `Rng`, `FixedClock`, `EventBus`, `Entity`, `World`, `Simulation`, `DebugMover`, determinism; 116 tests) ✅ · CI green ✅.
**Carried into M2:** delete `DebugMover`, `DebugMoverView` and the `main.ts` debug scene (T-41, T-49); `Vehicle` extends `snapshot()`; the determinism test's command stream starts to matter (M2-2); camera tuning (T-19) and arena from `ArenaDef` (T-20).

## 2026-11-19 · M1-6 · `RenderBridge`, coordinate conversion, fixed-step loop
**Built:**
- `render/coords.ts`: `toBabylonPosition` ((x, z) → (x, height, z)) and `toBabylonRotationY` (identity, per §9). The only sim → Babylon conversion.
- `render/views/EntityView.ts` (interface: `update(transform)`, `dispose()`) and `DebugMoverView` (orange box with a white nose on +z).
- `render/RenderBridge.ts`: `sync(entities, alpha)` diffs ids against views, creates/disposes, places each view at the interpolated transform (or the raw one with `?interp=off`). `Renderer.render(entities, alpha)` owns it.
- `app/debugParams.ts`: `?fps=N`, `?interp=off`. `main.ts`: rAF → frame gate (fps cap) → `FixedClock.advance` → n × `tick` → `events.flush()` → `render(world, alpha)`. Two `DebugMover`s circle the origin in opposite directions (radii 6.7 u and 10 u).
- Deleted the `src/render/views/index.ts` placeholder (T-12). README and `architecture.md` §2/§6 updated.
**Trade-offs:** T-46, T-47, T-48, T-49.
**Acceptance:** headless Chrome screenshots of the built game show both movers on the arena with noses along their direction of travel (inner turning right, outer turning left), with and without `?fps=20&interp=off`; console clean. Smoothness can't be judged headless (see issues) → open follow-up for Brendan's visual check.
**Issues:**
- Under `--virtual-time-budget`, headless Chrome fires animation frames rarely, so each frame hits the 5-tick cap (T-36) and the movers advance well under a second in 6 s. Expected, not a bug; it means headless screenshots can verify placement and orientation, not motion.
- The `?fps` gate first resynced to "now" after a long pause, letting one extra frame through; fixed to resync then schedule one interval ahead. Note: rAF only fires on display refreshes, so a cap like 24 on a 60 Hz screen alternates 33/50 ms frames that average out to the target, which is realistic stutter for a slow machine.
- Chrome's log flattens objects (`[object Object]`); the debug line is now a plain string.

## 2026-11-19 · M1-7 · Determinism test
**Built:** `tests/sim/core/determinism.test.ts` (4 tests, real Rapier). The scenario's `populate` places 12 `DebugMover`s with positions, headings, speeds and turn rates drawn from `simulation.rng`, so the seed decides the whole world; a scripted command stream (own seed) is passed every tick.
- Same seed → identical snapshots every 60 ticks for 600 ticks, and the same event log. `toEqual` compares numbers with `Object.is`, so floats must be bit-identical.
- Different seeds → different entity states (not merely different `rngState`).
- Two runs stepped alternately match a run stepped alone: no hidden state shared between simulations.
- Movers really move, so equal snapshots aren't trivially equal.
**Trade-offs:** T-45.
**Acceptance:** planted hidden shared state (a module-level counter nudging `DebugMover` speed by 1e-12 per call): the same-seed and alternating-runs tests both failed; reverted.
**Issues:** nothing in the sim draws from `Rng` during a tick yet, so a "different seed" test would have passed on `rngState` alone; the seeded `populate` fixes that. New follow-up: the command stream is ignored until M2-2.

## 2026-11-19 · M1-5 · `Entity`, `World`, `Simulation`
**Built:**
- `core/Transform.ts` (immutable position + heading) and `core/Entity.ts`: abstract base with an id assigned by `World.add`, `transform` / `previousTransform` (`saveTransform()` copies one to the other at the start of each tick), `snapshot()`.
- `core/World.ts`: ids from 1, never reused; `add` (queues `EntitySpawned`), `get`, `all`, `ofType(Class)` in insertion order (subclasses included); `remove` deferred to `applyRemovals()` (queues `EntityDestroyed` in removal order).
- `core/Simulation.ts`: `constructor({ seed, physics, populate })` owns the `Rng`, `EventBus`, `World` and physics world. `tick(commands)` saves transforms → steps `DebugMover`s → `physics.step(1/60)` → applies removals → counts the tick. `snapshot()` (plain numbers, JSON-safe) and `dispose()`.
- `vehicles/VehicleCommand.ts` (`throttle`, `turn`, `aimPoint`, `firePrimary`, `fireSecondary`; `PlayerId`). Commands are accepted but unused until M2.
- `debug/DebugMover.ts`: constant speed and turn rate.
- `main.ts` hands the Rapier world to a `Simulation` and runs one tick as a smoke check; the loop arrives in M1-6.
- 25 tests: `World`, `Entity`, `Simulation` (fake `PhysicsWorld` in `tests/sim/physics/FakePhysicsWorld.ts`, plus one run with real Rapier), `DebugMover`. Deleted the `src/sim/vehicles/index.ts` placeholder (T-12).
**Resolved:** T-26 follow-up (`Simulation` owns physics).
**Trade-offs:** T-40, T-41, T-42, T-43, T-44; T-26 reversed.
**Acceptance:** built game in headless Chrome logs `Simulation ready: tick 1, Rapier 2D physics` and `Babylon.js v9.34.0 - WebGL2`, no errors.
**Issues:**
- Headless Chrome with `--disable-gpu` reported "WebGL not supported"; software WebGL (`--use-angle=swiftshader`) works. Background preview server could only be stopped outside the sandbox. Both added to environment issues.
- New follow-up: snapshots cover only id and transform.

## 2026-11-19 · M1-4 · `EventBus` and `SimEvents`
**Built:** `src/sim/core/EventBus.ts`: generic `EventBus<Events>` with `emit` (queues), `on` (returns an unsubscribe function) and `flush` (delivers in emission order, then empties). `src/sim/core/SimEvents.ts`: the name → payload map, starting with `EntitySpawned` and `EntityDestroyed` (`{ id }`). `architecture.md` §5 now describes buffering. 11 tests, including `@ts-expect-error` checks that wrong names and payloads fail typecheck.
**Semantics chosen:** events emitted by a handler during `flush` wait for the next flush (no infinite loops); a handler unsubscribed mid-flush gets nothing further; subscribing the same function twice delivers once.
**Trade-offs:** T-38, T-39.
**Issues:** lint (`no-unnecessary-type-assertion`) caught a cast in `emit` that TypeScript turned out not to need; removed. One cast remains in delivery, where TypeScript can't relate a stored handler to its event name; commented.

## 2026-11-19 · M1-2 · `FixedClock`
**Built:** `src/sim/core/FixedClock.ts`: the fixed-timestep accumulator. `advance(elapsedSeconds)` returns how many 60 Hz steps to run (0..5); `alpha` is the leftover fraction of a step for render interpolation. It never reads a clock; the caller passes elapsed time. Zero, negative or NaN elapsed time is ignored. Options for step length and cap (validated, like T-35). `src/sim/core/time.ts` holds `TICK_RATE` / `TICK_SECONDS` for `Simulation` (M1-5) to share. 12 tests.
**Trade-offs:** T-36, T-37.
**Issues:**
- Float rounding: 144 frames of 1/144 s give 59 steps with alpha ≈ 0.99999999, not 60 steps. Harmless (the next frame runs the step), so the test checks steps + alpha ≈ elapsed / step instead of an exact count.
- After a stall the whole-step backlog is dropped but the fractional remainder is kept, so alpha stays in [0, 1) and its phase is unchanged.

## 2026-11-19 · M1 · Branch cleanup and merge workflow
**Built:** deleted 13 merged task branches on GitHub and 14 locally (each checked as merged into `main` first; none were unmerged). CLAUDE.md workflow step 4 and README now say: after green CI and the fast-forward merge, delete the branch on GitHub and locally; tag unmerged spikes before deleting.
**Trade-offs:** T-27 updated.
**Issues:** `m0-5-watch-eslint-config` existed only locally. Its single commit (`84cc1fe`) was fast-forwarded into `main` 36 s after it was made, before CI existed, so it reached GitHub through `main`; only the branch name was never pushed. Nothing was lost.

## 2026-11-19 · M1-3 · Seeded `Rng`
**Built:** `src/sim/core/Rng.ts`: mulberry32 with `next` ([0, 1)), `range` ([min, max)), `int` ([min, max], both ends included), `chance(p)`, `pick(list)`, and `getState` / `setState` (the whole state is one uint32). 14 tests in `tests/sim/core/Rng.test.ts`, including golden values from the reference mulberry32 so an accidental algorithm change can't silently alter seeded runs.
**Trade-offs:** T-34, T-35.
**Issues:** `pick` needs a cast (`as T`) because `noUncheckedIndexedAccess` (T-07) types `items[i]` as `T | undefined` even when the index is provably in bounds. Checking `item === undefined` instead would wrongly throw for lists that legitimately contain `undefined`; the cast is commented.

## 2026-11-19 · M1-1 · Math: `Vec2` and angle helpers
**Built:** `src/sim/core/Vec2.ts`: immutable ground-plane vector (`fromHeading`, `heading`, `add`, `sub`, `scale`, `dot`, `length`, `lengthSquared`, `distanceTo`, `normalize`, `rotate`, `lerp`, `ZERO`). `src/sim/core/angles.ts`: `wrapAngle` (→ [-π, π)), `angleDelta` (signed shortest turn), `lerpAngle` (short arc), `degToRad` (the GDD uses degrees). Heading convention (D3) documented in `architecture.md` §9 with a diagram and in CLAUDE.md conventions. 22 tests in `tests/sim/core/`. Deleted the `src/sim/core/index.ts` placeholder (T-12).
**Trade-offs:** T-32, T-33.
**Issues:**
- `Vec2.heading()` uses `atan2`, which returns (-π, π], while `wrapAngle` returns [-π, π). They differ only at exactly ±π; documented on each rather than forcing one range, since callers compare headings through `angleDelta`.
- `rotate` uses the heading sense (positive turns +z toward +x), the opposite of the textbook counter-clockwise rotation. Tested that `fromHeading(a).rotate(b)` equals `fromHeading(a + b)`.

## 2026-11-19 · M0-8 · README — M0 complete
**Built:** `README.md`: one-liner and status, quick start, scripts table, a one-minute architecture summary (sim/render split and why), folder layout, tech stack, a docs index with what each doc is for, and the workflow. CI badge. CLAUDE.md commands list gains `preview`.
**Trade-offs:** none new.
**Issues:** no license file exists yet, so the code is "all rights reserved" by default. Brendan's decision; flagged, not added.
**M0 done-when:** `npm run dev` shows the blank scene (headless Chrome, M0-3/M0-4) ✅ · CI green ✅ · deliberate boundary violation fails lint locally and in CI (M0-5, M0-7) ✅.

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
