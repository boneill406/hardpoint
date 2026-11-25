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
| MG heat bar colours don't feel quite right yet (gradient now `#c2cc4b` → yellow → orange → red, fixed across the bar) | — | Brendan revisits; at the latest in the M6 polish pass | M3-6 |
| Idea, undecided: barrel bob (elevation only, render-only) when the turret starts and stops traversing; maybe a tiny yaw settle | — | Brendan decides, at the latest in M6 | M3-1 |
| Point-blank shots are on screen for at most one frame (flight shorter than a tick); reassess once M6 adds muzzle flash and recoil, and if still odd add a render-only minimum visible flight (~3 frames, impact flash delayed to match) | — | M6 | M3-7 |
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
| In Claude Code's shell, `set -e` did not stop a `;` chain of checks (a lint failure was committed in M5-1) | Chain gating commands with `&&`; pipe test output to a file and grep it after, so the test exit code counts |
| `gh` can't read the macOS keychain from the sandbox | Run `gh` commands outside the sandbox. `gh auth status` works in a normal terminal |
| Git commands that write `.git/config` (`push -u`, `branch -D`) warn "could not lock config file" in the sandbox | The main action still succeeds. Run `git branch --set-upstream-to=origin/<branch>` in a normal terminal if tracking is needed |
| npm 11 skips `fsevents`'s install script (asks for approval) | Harmless: the prebuilt binary works. Optional: `npm install-scripts approve fsevents`. Review any newly flagged package before approving |
| Local Node must be ≥ 22.12 (Vite); CI uses `.nvmrc` | Brendan upgraded Homebrew Node 23 → 26 (Active LTS). An old Node 20 install in `/usr/local/bin` (pkg installer) may shadow Homebrew in some tools; removal recommended |

---

## Entries

## 2026-11-24 · M5-5 · Run stats and summary
- **`RunStats`** (`src/app`, pure): fed by the session's `ShotFired`, `Hit`, `WaveCleared` handlers; `setTicks(simulation.tickCount)` at `RunEnded`. Waves cleared, time (sim ticks, so pauses don't count), kills (player hits with `destroyed`), per-weapon fired / hit for the player's loadout in order (a weapon never fired shows "no shots"), damage taken (every hit on the player). The player is the only tank on its side, so any vehicle it hits is an enemy: no faction lookup needed. `formatRunTime` (m:ss), `formatAccuracy` ("12 / 20 hits (60%)").
- **Summary screen:** `MenuContent.table` (label–value grid): waves cleared, time, kills, cannon and machine gun accuracy, damage taken; seed underneath. Checked in a static page.
- **Tests:** shots and hits per weapon (enemy shots ignored), loadout listed when unfired, kills (not friendly-fire kills), damage taken from anyone, waves and time; formatting.

## 2026-11-24 · M5-4b · Title keys reaching the tank; P to pause
- **Bug (Brendan):** on the title, F / Space fired and WASD drove as the menu went away. The key that started the run was still held when play began, and driving and firing are hold-to-act. My M5-4 fix only dropped the starting frame. **Fix:** `InputGate` (`src/input`, tested): after start, resume or restart, drive and fire stay idle until a frame with nothing held; aim passes.
- **Esc exits fullscreen (Brendan):** browsers reserve Esc for leaving fullscreen and Safari offers no way to capture it (Chrome's Keyboard Lock API isn't in Safari). Added **P** as a pause key (`MENU_KEYS.back`); Esc still pauses, and the pad's Start is unaffected. GDD §3 controls updated.

## 2026-11-24 · M5-4 · Title, pause, summary, restart
- **`GameFlow`** (`src/app`, pure): title → playing ⇄ paused; `RunEnded` → ending (sim keeps ticking for 1.5 s defeat / 2 s victory, T-125) → summary. Pausing = not ticking.
- **`GameSession`** (`src/app`): one run's sim (seed new each run, `?seed=N` pins it), mode or sandbox scene, fire-warning signs, health overlay, AI labels, and its event wiring. Restart / Title dispose it and build a new one (T-124); `Renderer.resetWorld()` (new `RenderBridge.clear`, `ImpactFlashes.clear`, `ArenaView.clearWarnings`, `SliceCamera.reset`) forgets the old run's views. `main.ts` now owns only the app-lifetime pieces and the frame loop; it skips drawing while a session is being built, and the renderer gets its arena from `SLICE_ARENA` rather than a sim.
- **Menus:** `MenuScreen` (title "HARDPOINT / press any key / A", pause Resume / Restart / Title, summary VICTORY or DEFEAT with waves cleared and the seed, Restart / Title), `MenuNavigator` (wrapping highlight), `MenuInput` + `menuMapping` (keys from `MENU_KEYS`, pad A / B / Start / D-pad / stick, new presses only). Esc / Start pause and resume; window blur or a hidden tab pauses. HUD hidden on the title; banners only in play. The key that starts or resumes doesn't reach the tank.
- The sandbox (`?mode=sandbox`) starts in play (no title), can pause, never ends.
- Checked headless: title renders over the idle arena, no console errors. Pause, restart and summary not exercised headless (no key input there): Brendan to check in play.
- **Tests:** `GameFlow` (start, pause/resume rules, defeat 1.5 s and victory 2 s holds, no pause while ending, new run), `MenuNavigator` (wrap, hover, reset, empty), `menuMapping` (keys, pad buttons, held button once, stick once per push, first poll), `?seed=`.
- Trade-offs: T-124, T-125.

## 2026-11-24 · M4-5d · Reddish artifact near the fire warning
- **Report (Brendan):** sometimes a reddish artifact under an enemy's barrel and the hazard sign just before it fires.
- **Likely cause:** in its last 30 % the sign switched to a CSS `filter: drop-shadow(...)` orange glow while moving every frame to follow the tank. Safari leaves stale paint behind filtered elements that move (same family as the M3-6 armor-bar bug). Not reproduced here (no Safari headless); matches when and where it appears.
- **Fix:** no CSS filters on the sign. The glow is an orange outline drawn inside the SVG (brighter and wider while blinking), the drop shadow a dark offset copy of the triangle. No other CSS filters in `src/ui` or `src/render`.
- Brendan to confirm in Safari; if it persists, the next suspect is the sign's per-frame `transform` on a layer over the WebGL canvas.

## 2026-11-24 · M5-6a · Run HUD: wave line, banners, repair flash
- **`waveHudState(status)`** (`src/ui/waveHud.ts`, pure): "Wave n / 5"; enemies left while a wave is on; "Next wave in n" in the breather (whole seconds, never 0); the banner for the phase: "WAVE n / 5" (banner), "WAVE CLEARED", "VICTORY", "DESTROYED".
- **`Hud`:** a top line with the wave and enemies or countdown (hidden in `?mode=sandbox`); `flashRepair(amount)` on `BreatherStarted`: green glow on the armor bar and "+20" beside the number, fading out (box-shadow and colour animations, not row opacity, per the M3-6 Safari fix).
- **`Banner`** (`src/ui/Banner.ts`): big centre text that pops in when it changes; shown purely from the mode's phase, so it can't drift from the sim.
- Console wave logs removed (the run end is still logged until the summary screen, M5-5).
- Checked in a static page (Chrome): wave line, countdown, banner, repair flash. First layout put the "+20" mid-row; grouped it with the armor number.
- **Tests:** `waveHudState` (fighting line, wave banner, cleared, countdown rounding, victory/defeat).

## 2026-11-23 · M5-3 · Breather and repair
- **`Health.repair(amount)`:** adds up to max, returns what was actually added; a destroyed vehicle can't be repaired.
- **`WaveSurvivalMode`:** when "WAVE CLEARED" ends, the breather starts with the player repaired by the cleared wave's `repair` × max armor (20 % for waves 1–4; wave 5 has none, as it ends the run), and emits **`BreatherStarted { wave, seconds, repaired, healthNow }`**. The 5 s countdown is `status.secondsLeft`; nothing spawns until the next banner. Console log until the HUD (M5-6a) shows it with a green flash.
- **Explained to Brendan:** `GameMode.ts` is only the interface; the per-mode rules (what a death means for the run) live in `WaveSurvivalMode`, inside the sim; the `Simulation` core keeps the rules that are the same in every mode.
- **Tests:** `Health.repair` (adds, caps, reports, ignores negatives, not when destroyed); breather repairs 20 once (50 → 70), capped at max (95 → 100, reports +5), counts down 5 s with no warnings or spawns, then wave 2's banner.
- Trade-offs: T-123.

## 2026-11-23 · M5-2 · Gate warnings and blocked gates
- **`GateSpawner`** (`sim/modes`, split out of `WaveSurvivalMode`, which now only runs phases): a wave's groups become **spawn units** (a `one-gate` group = one unit of 1–2 tanks; a `spread` group = one unit per tank). Each unit: scheduled → **warned** 1 s before it's due (`GateWarning { gate, count, seconds }`) → spawned; gate picked by the sim `Rng` among *free* gates, unused-this-wave first. If its spots aren't clear when due (any vehicle, the player included, within `slots.clearance` 3 u), it warns at another free gate and comes out 1 s later; with none free it waits and warns as soon as one clears (T-121). Timing unchanged when nothing blocks (wave 1's tank still emerges as the banner ends).
- **Render:** `ArenaView` gives each gate panel its own material and blinks it orange at 4 Hz for the warning (`Renderer.warnGate`; T-122). Not seen in motion: headless Chrome doesn't advance the game far enough to reach a spawn.
- **Answered:** gate doors opening as tanks come out → post-slice backlog (could fold into M6).
- **Tests:** warning 1 s before the spawn at the same gate; spread group warns all three gates at once, a pair warns with count 2; gate blocked when due → re-warn elsewhere, spawn 1 s later there; all gates blocked → no warning or spawn, enemies left still 1, then warn and spawn once one clears. M5-1 tests unchanged and passing.
- Known environment issue added: `set -e` didn't stop a `;` chain; gate with `&&`.
- Trade-offs: T-121, T-122.

## 2026-11-23 · M5-1 · Game mode and waves
- **`GameMode`** (`sim/modes`): `start` (spawn the starting entities), `update` every tick after removals, `outcome`. `ModeContext` gives the tick, world, arena, events and `Rng`. `Simulation` takes `mode?` beside `populate`. `modes/index.ts` placeholder removed.
- **`WaveSurvivalMode`:** phases banner (2 s) → fighting → cleared (1.5 s) → breather (5 s) → next wave; victory as soon as the last wave clears; defeat the tick the player's tank is gone, in any phase. Spawn groups emerge `at` seconds after the banner, `one-gate` side by side in the gate's two slots (2.4 u apart, 2.5 u in) or `spread` one per gate; gates shuffled with the sim `Rng`, unused-this-wave first (T-120). Enemies count as destroyed once gone from the world (T-119). `status` (phase, wave, enemies left incl. unspawned, seconds left) for the HUD. Events `WaveStarted`, `WaveCleared`, `RunEnded`; `secondsToTicks` in `core/time`.
- **Data:** `modes/WaveDef.ts` types; `defs/waves.ts` `SLICE_WAVES` (the plan's five waves, repair 20 % after waves 1–4). The 1 s gate warning is in the timing data but used from M5-2.
- **App:** the page now runs the waves by default; `?mode=sandbox` brings back the M4 debug scene (`?enemies=`, `?dummies=`), `?wave=N` starts at wave N. Wave events go to the console until the HUD shows them (M5-6a). Restart is still a page reload until M5-4.
- **Tests:** mode against real Rapier on the slice arena (unkillable player, enemies removed by the test): banner timing to the tick, lone tank centred 2.5 u inside a gate facing in, clear only when all spawned are gone and unspawned count as left, cleared + breather = 6.5 s to the next wave, one-gate pair 2.4 u apart, spread uses all three gates, a later group takes an unused gate (5 seeds), gates vary by seed and repeat with it, defeat in any phase with no spawns after, last wave wins at once, a whole run spawns 1/2/3/4/5 then victory, same seed same run, start wave validated. Wave defs: 1→5 tanks, whole ticks, placeable groups, repair 0–1.

## 2026-11-23 · M5 plan approved
- Saved [`plans/m5-waves.md`](plans/m5-waves.md). Brendan's changes to the draft: wave difficulty has several levers, not count only (timed spawn groups, together or staggered, one gate or spread; gates picked by the seed each run so the order can't be learned; repair set per wave); gate warning **1 s**, not the GDD's 2 s; crates resetting stays out (post-slice). GDD §2 updated. Off-screen arrows are M5-6b.

## 2026-11-23 · M4 close
- All M4 tasks done (M4-1 to M4-6, plus 4-5b/4-5c telegraph changes). Done-when: paths around cover, engages, repositions, never permanently stuck (tests: pathfinding, follower sweep, state transitions, real-Rapier hunts). Brendan: "functional for now".
- **Deferred to after the slice** (post-slice backlog in `milestones.md`): an AI polish pass, and **difficulty levels** whose first knob is aim lock during the fire warning (easy: lock when the warning starts; middle: lock for its last part; hard: track to the shot, as now). Context: with tracking, a shell at 70 u/s from 8–12 u can't be dodged even at full speed sideways (~1 u travel during flight vs ~1.2 u needed).

## 2026-11-23 · M4-6 · Hold fire with an ally in line
- **`SimQueries.firstVehicleHit(from, to, radius, shooter)`:** the vehicle a swept circle would strike first; undefined if a wall or cover comes first. Fakes updated (`fakeWorld` treats hulls as 1 u discs).
- **`AiController`:** while on target, casts 0.3 u wide (`EngageDef.allyCheckRadius`: shell 0.07 + spread margin) along the turret heading to the target's distance; if the first vehicle is an ally it releases the trigger. Checked every tick, so an ally driving in mid-windup cancels the shot (the sign disappears). Friendly fire itself stays on. `debug.allyInLine`; `?ai=on` shows "engage · ally in line".
- **Finding:** in four real-Rapier hunts (2–3 enemies, 40 s, still player) there were **0 friendly hits with or without the check**: the sight rule (an ally in between blocks sight) and firing-spot spacing already prevent most. The check adds margin for spread and for allies just off the thin sight ray.
- **Tests:** controller (ally between → hold; moves out → fire; ally arrives mid-windup → release; ally beyond the player or a hostile between → fire; ally 1.2 u off the line → hold); real Rapier `firstVehicleHit` (tank between, ignores shooter, pillar first → none, tank just off a thin sight line → hit).
- Trade-offs: T-118.

## 2026-11-23 · M4-5c · Telegraph tuning: 0.5 s, smaller sign
- Brendan tried the 0.4 s hazard sign in play (and confirmed the armor-bar fix in Safari). Changes: windup **0.4 → 0.5 s** (30 ticks; enemy shots every 2.9 s) and the sign **34 → 24 px** wide.
- **Tests:** windup timings moved to 30 ticks (shots at 30, 204, 378); test windows lengthened to fit the later second shot. T-117 updated.

## 2026-11-23 · M3-6 fix · Armor bar stale green in Safari; one number format
- **Bug (Brendan, Safari):** below 30% armor the bar showed red at the right width plus a stale green piece out to where it went critical, still there at 0. Cause: the critical pulse animated the whole row's `opacity`, which puts it on its own compositing layer; Safari then didn't repaint the area the fill shrank away from. Chrome repaints, so a headless Chrome check showed nothing. **Fix:** the pulse now animates the fill's `background-color` (red ↔ dark red), so there's no separate layer. Not yet checked in Safari by me (no headless Safari here).
- **Mismatched numbers:** the HUD showed armor rounded up to whole numbers, the health bar over the tank one decimal. Both now use **`amountLabel`** (`src/ui/amountLabel.ts`, replaces `damageLabel`): one decimal, whole numbers plain, float noise rounded away (84.4, 25, 32.5). The damage numbers use it too.
- **Tests:** `amountLabel` (formatting and float noise). One full `npm test` run had 4 determinism/hunt tests fail; they passed alone and on the next full run (likely timeouts under load). Watch for it recurring.

## 2026-11-23 · M4-5b · Hazard-sign fire telegraph; windup 0.4 s
- **Why:** Brendan wasn't convinced by the orange muzzle sphere. Options discussed: aim line, ground marker, hull flash, barrel pull-back, sound, particles, or slow shells instead of a windup. Brendan picked a hazard-label warning sign by the barrel.
- **`TelegraphSigns`** (`src/ui/`): an inline-SVG warning triangle (black edge, black "!") over the shooting gun's muzzle, 34 px, fixed on screen. Dark amber at first, it fills hazard-yellow from the bottom over the windup (full = the shot), pops in with a small overshoot, and blinks with an orange glow for the last 30%. Removed on `ShotFired`, `TelegraphCancelled`, the shooter disappearing, or 0.1 s past its time. The animation is the pure `telegraphSignFrame` (`src/ui/telegraphSign.ts`).
- **`Renderer.muzzleScreenPosition`:** the sim's muzzle offset applied to the tank's interpolated position, so the sign doesn't jitter at 60 Hz ticks. `render/vfx/TelegraphGlows` deleted.
- **Windup 0.3 → 0.4 s** (24 ticks) in `INSURGENT_CANNON`: enemy shots every 2.8 s (was 2.7). Reload left at 2.4; drop it to 2.3 if enemies feel slow.
- **Shell casings** added to M6-2 and GDD §8 (Brendan's polish idea).
- **Tests:** sign frame (fill 0 → 1 exactly at the shot, pop-in, urgent at 70%, expiry); windup tests moved to 24 ticks (shots at 24, 192, 360). Sign look checked in a static screenshot; not yet seen in a live fight.
- Trade-offs: T-117.

## 2026-11-23 · M4-5 · Fire telegraph (windup); barrel hits deal damage
- **`WindupLimiter`:** trigger held `seconds` (insurgent cannon: 0.3 s = 18 ticks) before the shot; releasing cancels; each shot needs a fresh windup. **`Weapon`** updates other limiters first and feeds windups "held and otherwise ready", so the windup is the last 0.3 s before each shot (insurgent cadence 2.4 + 0.3 s). `Weapon.telegraph()` reports started / cancelled per tick; the sim emits **`ShotTelegraphed`** (shooter, hardpoint, weapon, seconds) and **`TelegraphCancelled`**.
- **Placeholder glow** (`render/vfx/TelegraphGlows`): an orange sphere at the muzzle, swelling over the windup and following the turret; ends on `ShotFired`, a cancel, or timeout. M6 replaces it. Not yet seen in motion by me (headless capture can't reach an enemy shot quickly).
- **AI:** keeps holding through aim drift up to 3 × 2° once a windup runs (`EngageDef.holdSlack`), so tracking you doesn't cancel every telegraph (T-116).
- **Barrel hits deal damage** (Brendan): `ArmorDef.barrel` multiplier, ×0.65 like the front (my pick: barrels sit over the front, so it reads as hitting armor); `Hit.face` is `'barrel'` for these. GDD §3/§5 and M3 plan D17 amended (T-114).
- **Tests:** WindupLimiter (18 ticks, release resets, fresh windup per shot, progress), Weapon (windup after reload: shots at 18, 180, 342; telegraph 18 ticks before each; cancel; player cannon unchanged), sim events (telegraph then shot at +18; cancel), AI hold slack, barrel hit = 32.5. The insurgent firing test window grew from 150 to 200 ticks for the extra 0.3 s.
- Trade-offs: T-114, T-115 (windup special-case in `Weapon`), T-116.

## 2026-11-23 · M4-4b · AI controller, firing spots, debug scene
- **`AiController`** (`vehicles/controllers`): GDD §5 states. *Advance*: pick a firing spot, follow a path to it (replan every 0.5 s, staggered by id; re-pick if the spot loses sight or the target moves off the rings), gun along the path. *Engage*: stop, turn the hull until the target is within 15° of the nose, track with the turret, hold the trigger when within 2° and in sight. *Reposition*: after 1.5 s without sight, the target behind (> 135°) within 8 u, out of range (> 16 u), or the follower gave up; picks a new spot ≥ 3 u away. *Idle*: no living hostile. `debug` snapshot for the views.
- **`chooseFiringSpot`** (`ai/FiringSpots`): 72 candidates (rings 8/10/12 u × 24), open and with sight; cost = distance + 6 near an ally (< 4 u) − 4 beside cover when repositioning; best 6 get a real path check. `EngageDef` in `AiDef`; `aimLead` 0.
- **Debug scene** moved to `app/debugScene.ts`: player + `?enemies=0..3` hunters (top, left, right gates, 2.5 u inside), `?dummies=on`. Circler removed (T-49, T-98 closed). **Debug views:** `?ai=on` (path line, spot ring, state label), `?nav=on` (blocked cells, thin instances, rebuilt when the grid changes).
- **First real run:** from the top gate the insurgent went round the centre pillar to a spot 12 u from the player, engaged at ~8 s and landed 7.8-damage front hits (some stopped on the player's barrel: no damage). With three enemies and a normal player, the player died inside 20 s (the test now uses a tough player to check positions).
- **Tests:** state transitions with a fake world (`tests/sim/ai/fakeWorld.ts`: real nav-grid rules, hand-moved vehicles, scripted sight): spot on the rings, nearest spot, arrive+sight → engage, arrive without sight → reposition, idle, hull turning and the 15° band, fire only aligned and in sight, no lead, lost sight 1.5 s → reposition ≥ 3 u, target behind, out of range. Spot choice: sight/open filter, ally spacing, cover trade-off, min move, none. Real Rapier: top-gate hunt hits a still player; three gates all engage at separate spots; same seed → identical hunt.
- Trade-offs: T-110 (ties by order), T-111 (straight-line scoring), T-112 (cover = any blocked cell), T-113 (fire only when engaging).

## 2026-11-23 · M4-4a · Path following and stuck recovery
- **`PathFollower`** (`sim/ai`): pure-pursuit steering toward a point 2 u along the path; turn ∝ heading error (full at 25°); pivot in place beyond 60°; throttle eases with error and over the last 2 u (min 0.25); stops within 0.5 u. Reports the steering point (`toward`) so the controller can aim the turret along the path.
- **Stuck recovery (D7):** a 1 s window with < 0.3 u moved and < 15° turned → reverse 0.6 s with a turn (alternating side), then `replan`; after 3 back-offs toward the same goal, `gave-up`. Pivoting counts as progress.
- **`AiDef`** (`sim/ai`) with `INSURGENT_AI.driving` in `defs/ai.ts` (D17); engagement fields come in M4-4b.
- **Issue 1, barrel snag:** the first real run stalled next to the centre pillar. The turret is stabilised, so while the hull turned to go round, the barrel kept pointing straight at the pillar and its tip (1.6 u from the pivot) caught the face. Fix: the follower reports its steering point and the controller aims there (T-108).
- **Issue 2, paths too close to cover:** a 20-trip sweep had one trip give up beside a crate. The grid only kept cell *centres* 1.0 u from cover, but straightened paths run anywhere inside open cells, so they could pass ~0.65 u from cover; the tank is 0.8 u half-wide. Fix: a cell is open only if every point in it is ≥ 1.0 u away (centre test + half the cell diagonal). NavGrid tests updated to the new rule, plus a property test over every open cell's corners.
- **After the fixes:** 60/60 sweep trips (3 seeds) arrive; 2 needed back-offs (random starts against cover). A 20-trip version is now a regression test (~1.5 s).
- **Tests:** steering (straight, pivot both ways, proportional turn, slow/arrive, minimum throttle, look-ahead round a corner, idle), stuck (window → back-off → replan, pivot isn't stuck, alternating back-off, gave-up after 3, new goal resets), real Rapier (round the centre pillar, pivot then drive, ramming a pillar on a bad path → back-off → replan → arrive, 20-trip sweep).
- Trade-offs: T-103 revised (whole-cell rule), T-108 (turret along path), T-109 (stuck rule).

## 2026-11-23 · M4-3 · Line of sight; read-only world view for controllers
- **`ControllerContext`** now carries `world: SimQueries`, and `vehicle` is a `VehicleView` (read-only interface that `Vehicle` implements: no copying). A compile-time test (literal types asserting `applyCommand`, `drive` and `health.damage` aren't on the context's vehicle type) fails typecheck if the context ever hands out the live object again; checked by swapping the type back (3 errors).
- **Process slip:** the first push went out with a lint/typecheck failure (unused import; lint rejected `@ts-expect-error` calls) because my command chain didn't stop on it; CI caught it. Fixed in a follow-up commit; checks now gate the commit.
- **`WorldQueries`** (the sim's implementation): `vehicles()`, `vehicle(id)`, `lineOfSight(from, to, { viewer, target })` (circle r 0.1 swept by Rapier; the viewer's own body is ignored; reaching the target counts as clear), `findPath(from, to, forVehicle)` (cells within 2.5 u of other tanks cost +4), `navGrid`. Tuning in `defs/ai.ts`.
- **Tests:** sight blocked by a pillar, a tank in between, a crate until it breaks; clear past a 45°-turned tank's corner; viewer's own hull ignored; paths bend around other tanks but not their own; grid replaced after a crate breaks. Two first-run failures were test setup mistakes (no controller to capture the view; a line ending exactly on a wall face).
- Trade-offs: T-106 (option A), T-107 (planar sight).

## 2026-11-23 · M4-1, M4-2 · Navigation grid and pathfinder
- **M4 plan approved** (D1: controllers get a read-only `SimQueries` view, option A; D11 windup limiter; D14 debug scene; aim lead becomes `AiDef.aimLead`, 0 in the slice).
- **M4-1:** the insurgent def already matches GDD §5 on every value; no code.
- **`NavGrid`** (`sim/ai`): 0.5 u cells over the floor; a cell is blocked if its centre is within 1.0 u of a wall, pillar or standing crate (`NAV_GRID` in `defs/ai.ts`). Immutable; helpers for cell lookup, nearest open cell, and "is this straight line all open".
- **`Pathfinder`:** A*, 8 neighbours, octile heuristic, no corner cutting; deterministic tie-break (insertion order). The cell path is straightened by string-pulling. A blocked start or goal snaps to the nearest open cell. Optional extra cell cost (for other tanks, D6).
- **`Simulation`** builds the grid with the arena and rebuilds it at the end of any tick that broke a crate (`navGrid` getter).
- **Issue found by a test:** straightening ignored the extra cost, so a path routed around a costly area got pulled straight back through it. Shortcuts may now only cross cells no costlier than the stretch they replace.
- **Measured:** corner-to-corner path 0.9 ms; full grid build ~10 ms.
- **Tests:** NavGrid (clearance edges, rounded corners, off-grid, nearest open), Pathfinder (straight, around a crate, sealed area → none, no diagonal squeeze, blocked start/goal, cost avoidance, deterministic), slice arena (start open, every gate reaches the start, broken crate reopens its cells).
- Trade-offs: T-103 (circle clearance), T-104 (full rebuild), T-105 (sampled straightening).

## 2026-11-21 · M3 close · Armor pick, HUD heat bar
- **Armor pick:** Brendan chose `struck`; `TANK_ARMOR.faceRule` is now `struck`, and `?armor=direction` switches back (T-102). GDD §5, plan D5, architecture updated; tests that relied on the old default now name their rule.
- **MG bar:** labelled "Machine gun heat". Its gradient (green → yellow → orange → red) now spans the full bar and the heat reveals it from the left (`clip-path`), instead of the whole gradient squeezing into the filled part.
- **MG bar colour:** starts at the yellow-green the old gradient had at the 30% re-arm line (#c2cc4b), not bright green (Brendan).
- **Overlay on by default:** health bars and floating damage numbers now show without a URL flag; `?hp=off` hides them (T-101 closed). Still a debug-styled overlay; whether enemy health bars belong in the finished game is a GDD §7 question for M6.
- **M3 done:** done-when checked in play by Brendan (front vs rear damage visible, MG overheats and re-arms).

## 2026-11-21 · M3-6 · HUD; floating damage numbers
- **HUD (D10):** `ui/Hud` (bottom-left panel): armor `n / max` with a bar that turns red and pulses at ≤30%; cannon reload ("Ready" / "Reloading"); MG heat in % with a marker at the 30% re-arm point and a pulsing "Overheated". `ui/hudState` derives the numbers (unit-tested). Checked in headless Chrome: renders over the game at 1280 × 800.
- **Damage numbers (Brendan's request):** in the `?hp=on` overlay each `Hit` now spawns its damage ("32.5") at the impact point, rising ~36 px and fading over 0.9 s, re-projected each frame so it stays put as the camera moves; a small random sideways nudge (render-only) keeps MG bursts apart. The bar label is just `health/max` now. `Renderer.groundToScreen` added beside `screenPositionOf`. Not yet seen in motion by me (headless capture has no firing).
- Trade-offs: T-100 (CSS in `Hud.ts`), T-101 (damage numbers debug-only).

## 2026-11-21 · M3-5 · Breakable crates, armor dummies, `?hp=on`
- **Crates (D7):** a `Prop` that is `destructible` and hit by a `breaksCover` weapon (cannon) is removed at the end of the tick; `PhysicsBridge` drops its collider at the next sync, so the next shell flies through. The MG stops on crates without breaking them; pillars never break.
- **Dummies (D8):** three idle insurgents in `main.ts` at (−6, −9), (0, −9.5), (6, −9), each turned so its front, left side or rear faces the player start. The circling insurgent stays. The crates at (±4, −12) sit on the line from the start to the outer dummies: drive forward or break them.
- **Overlay (D9):** `ui/HealthOverlay` (HTML, read-only) draws a bar and "health/max −32.5 front" over each damaged vehicle, plus the active armor rule top-left. Positions come from `Renderer.screenPositionOf` (drawn transform projected to CSS pixels). Replaces the M3-4 console log (T-97 closed). `src/ui/index.ts` placeholder deleted.
- **Tests:** `cover.test.ts` (cannon breaks a crate and its collider; MG doesn't; pillars don't), `hitLabel`, `?hp=` parsing.
- **Not yet verified in a browser by me:** the overlay's screen placement.
- **Pending:** Brendan's done-when check (front vs rear damage visible; MG overheats and re-arms) and the armor rule pick (`?armor=struck` vs default).
- Trade-offs: T-98 (dummies in the debug scene), T-99 (crates vanish).

## 2026-11-21 · M3-4 · Damage and directional armor
- **Built:** `ArmorDef` (multipliers, ±45° arcs, face rule) with `TANK_ARMOR` in `defs/armor.ts`; `ArmorProfile` (face + multiplier); `Health`; `DamageResolver`. `VehicleDef` gains `health` (player 100, insurgent 60) and `armor`. `Hit` event (target, attacker, weapon, face, damage, health left, destroyed, point). `VehicleSnapshot` includes health (clears the M1-5 follow-up).
- **Flow:** `advanceProjectiles` emits `ProjectileImpact`, then for a hull hit on a vehicle asks `DamageResolver`; at 0 health the vehicle is removed at the end of the tick. Barrel hits (part `barrel`) deal nothing (D17). A vehicle destroyed earlier in the tick takes no more hits.
- **Both face rules (D5):** `direction` (default) uses the shot's travel heading reversed; `struck` uses the surface normal from the cast. `?armor=struck` overrides every tank through `SimulationOptions.armorRule`.
- **Tests:** arc edges (10°, 44°/46°, 134°/136°), `struck` vs `direction`, corner normals; against Rapier: front 32.5 / side 50 / rear 60 (capped), GDD kill counts (2 front, 1 rear), removal and shots passing through afterwards, barrel hit = no damage, a hull at 40° counts as rear by direction but side by struck, MG 3 per hit.
- **To see it:** hits print in the console (`Hit #2 (front) −32.5 by Cannon: 27.5 left`) until M3-5's overlay. The circling insurgent can now be destroyed; reload to bring it back.
- Trade-offs: T-95 (instant removal), T-96 (direction from shot heading), T-97 (console log).

## 2026-11-21 · M3-8b · Barrel stall fixes, smoother MG streaks
- **Problems (Brendan):** barrels sometimes went into each other; a barrel could swing into a crate's corner; MG rounds looked slightly laggy since the move to 100 u/s.
- **Cause 1:** the stall rule only asked "would the barrel overlap at the new angle?", with an escape hatch: if it already overlapped, turn freely (so it couldn't get stuck). Any small overlap (the solver leaves contacts slightly penetrated, a corner caught by the hull turning) opened the hatch, and the turret swept straight in.
- **Cause 2:** barrel-vs-barrel was left to physics. Two turrets turning toward each other in the same tick each saw the other's barrel where it *was*, so both moved and the solver shoved the tanks apart.
- **Fix:** `Simulation.barrelDepth` measures penetration depth (radius halving on the Rapier overlap query, skipping barrel colliders) plus a sim-side segment-to-segment check against other tanks' barrels (`core/segments.ts`: `segmentDistance`, `capsuleAxis`). A turn is allowed only if it doesn't deepen the overlap; the escape hatch is gone (a barrel pushed in can still swing *out*).
- **Tests:** `segments.test.ts`; in `barrels.test.ts`, crate corner, two turrets meeting (fails with the barrel-vs-barrel check removed), and a barrel spawned 0.2 u into a pillar (fails under the old rule). The crate-corner scenario passes under both rules, so it isn't a proven repro of what Brendan saw.
- **MG streak:** the 1.2 u streak was shorter than one frame of travel (1.7 u at 60 fps), so each round jumped a visible gap every frame. Streaks now outlast a frame (tracer 2.4 u, shell 2.0 u) and fade from tip to tail so rounds 8 u apart don't read as joined. Render-only.
- Trade-offs: T-93 revised (depth rule), T-88 revised (lengths, fade).

## 2026-11-21 · M3-8b · Solid barrels
**Built:**
- `PhysicsWorld`: `addBarrel(body, segment)` (massless capsule on a vehicle body, contact events on), `setBarrel(collider, segment)` (re-pose from a world-space segment; converted to the body's local frame inside the Rapier adapter), `overlaps(segment, ignore)`; `CastHit.collider`. Types `ColliderHandle`, `Segment`.
- `PhysicsBridge`: barrel colliders per vehicle and hardpoint, re-posed before each step, `isBarrel(collider)`.
- `Turret.step(…, canFace)`: if the full turn would overlap, a 5-step halving search finds the furthest clear heading and the turret stalls there; allowed to turn if already blocked. `Vehicle.barrelSegment(mount, turretHeading?)`. `Simulation.barrelsClearAt` tests every colliding turret barrel.
- `ProjectileImpact.part` (`body` | `barrel`): shots stop at barrels; M3-4 will skip damage for barrel hits.
- Tests: hull-geometry tests (collision, tank contacts) now use a tank with no weapons fitted, and the muzzle-clearance tests use non-solid barrels (helpers `bareHull`, `nonCollidingBarrels`), so each tests one thing. 8 new barrel tests (322 total), real Rapier: nosing in stops at the barrel tip with the hull 0.4 u off the wall; the turret stalls with the barrel at the wall and the tank not shoved; it turns freely once aimed away; driving along a wall doesn't snag; top speed unchanged (massless); a barrel bumps another tank and reports a collision; shots meeting a barrel report `barrel`, shots at the hull `body`.
**Trade-offs:** T-92, T-93, T-94; T-75 reversed.
**Acceptance:** planted bug (no stall test): both stall tests failed; restored. Throwaway build driving into a wall at an angle: the barrel stops at the wall with no clipping, but the hull slowly slewed. Measured: ~2°/s while pushing, versus ~34° of spin from an off-centre hull ram (existing physics); kept, recorded as T-94 for Brendan to judge.
**Issues:** my first barrel tests had geometry slips (a reach helper added the radius twice; a shot target's barrel ended 0.15 u short of the line of fire; a shooter fired before its turret had turned; a rammed target moves). All were the tests, fixed.

## 2026-11-20 · M3-8a · Hardpoints and barrels as data
**Why:** Brendan wants barrels to collide and the mount mechanics to be extensible for future barrel styles and weapons fitted to hardpoints.
**Built:** `HardpointDef` (id, `on` turret | hull, `at` forward/right, size small | large, trigger, cosmetic height) and `VehicleDef.hardpoints` + `loadout` replace the M3-2 mount list. `WeaponDef` gains `size`, `barrel` (`BarrelDef`: length, radius = collision/clearance radius, look `tube-brake` | `thin-tube`, `collides`) and `muzzles` (offsets; twin guns alternate). `WeaponMount` = weapon on a hardpoint: derived `muzzleOffset`, `advanceMuzzle`, clearance, snapshot. `Vehicle`: `mountOrigin` / `mountFacing` (turret pivot and aim, or hull centre and heading). `ShotFired` gains `hardpoint`. `createVehicle` validates loadouts (unique ids, known hardpoints, matching sizes). Render: `PrimitiveTankModel` builds a gun per fitted hardpoint, parented to turret or hull, drawn by the barrel's look. Player: `main` (large, primary) + `coax` (small, secondary); insurgent: `main`. Muzzles land exactly where the hand-set ones were.
**Tests:** 7 new (314 total): longer barrel moves the muzzle, empty hardpoint fires nothing, twin muzzles alternate, a hull hardpoint fires along the hull whatever the turret aims at, wrong size / unknown hardpoint / duplicate ids rejected.
**Trade-offs:** T-91.
**Acceptance:** close-up screenshot (throwaway camera, reverted): both barrels drawn as before.

## 2026-11-20 · M3-7 follow-up · Rigid barrels; steady streaks
**Why (Brendan):** barrel retraction looked cartoony and unrealistic ("I'd rather the barrel be rigid"); MG rounds looked "laggy" after the last change; impacts look good.
**Changed:** `TankView` no longer moves the guns: barrels are rigid and can clip into walls again (T-75 accepted, with the sim's clear-point firing kept, so shots still never start inside or behind a wall; T-90 revised). Streaks are a fixed length per look (shell 1.4 u, tracer 1.2 u), clipped at the muzzle: the per-frame-travel length pulsed with frame-time wobble, the likely "lag" (T-88 revised). Backlog: barrel as a collision part.
**If the MG still feels laggy:** next step is a `?stats=on` overlay (fps, worst frame time) to measure, then pooling projectile and flash meshes (T-85).

## 2026-11-20 · M3-7 · Muzzle clearance and barrel retraction
**Built:**
- `WeaponMountDef.clearanceRadius` (cannon 0.12, coax 0.06: barrel-wide). `WeaponMount` keeps `clearance` (0..1 of the pivot→muzzle line that is unobstructed) and its previous value. `Simulation` phase 5b sweeps that circle from the turret pivot to each muzzle (ignoring the own hull) after the turret aims. `Vehicle.clearMuzzlePosition`: shots start there, so a blocked barrel's shot hits the obstacle the same tick. Snapshot includes clearance.
- View: `TankModel.guns` (one node per weapon slot, origin at the muzzle tip, barrel built backwards from it) replaces `barrel`; `PrimitiveTankModel` takes the whole `VehicleDef` and places each gun from its mount's muzzle, so drawn tips are the sim's muzzles; the coax is its own node (retracts independently). `TankView` sets each gun's z to the interpolated clearance × muzzle distance.
- Also on this branch: MG 10 → **12 rounds/s** (exactly 5 ticks; overheats after 2.5 s; ~36 damage/s); GDD §4 and plan; MG tests updated (30th round on tick 145, next at 313).
- 6 new tests (307 total), real Rapier: clear in the open; nose to a wall the cannon's clearance matches the circle touching the wall; a blocked shot starts short of the wall and hits it the same tick; over 30 ticks no shot from either gun starts inside or beyond the wall; point-blank against a tank, the shot hits that tank; previous clearance kept.
**Resolved:** T-75 (barrel poking into walls).
**Trade-offs:** T-90; T-75 reversed.
**Acceptance:** planted bug (shots from the full muzzle): 2 tests failed; restored. Throwaway nose-to-wall build (reverted): the barrel is drawn retracted with the brake at the wall's face.
**Also discussed:** how frames draw interpolated ticks, and why point-blank shots are seen for ~1 frame; follow-up for M6 (minimum visible flight if still odd).

## 2026-11-20 · M3-3 follow-up 4 · Impact flash; MG spacing
**Built:** `render/vfx/ImpactFlashes` (deleted the `vfx/index.ts` placeholder, T-12): a self-lit sphere at each `ProjectileImpact`, 0.7 u for shells and 0.25 u for MG rounds, growing and fading over 0.12 s (per-mesh visibility, shared material). `ProjectileImpact` gains `look`. `main.ts` subscribes; `Renderer.flashImpact` / per-frame update. T-89.
**MG spacing:** rounds are 10 u apart by physics (100 u/s, 10/s); only the drawn share changed. Full streak (~2.2 u per round) read as continuous, half (~1.1 u) as sparse; now rod 0.35 u and streak at 75% of the frame's travel, capped 1.5 u (~1.6 u). Gameplay levers (12 rounds/s, slower rounds) left alone. T-88 updated.
**Acceptance:** throwaway build (reverted) firing at a crate: no flash caught at 0.12 s (headless frames are further apart than the flash lasts); with a 5 s flash it shows on the crate's near face, confirming the wiring.

## 2026-11-20 · M3-3 follow-up 3 · Shot polish
**Why (Brendan):** a shot's first frame had no streak; MG rounds could be thinner; MG rounds appeared to leave from over the turret, not the barrel; wanted an MG muzzle brake; close to a crate, no shell is seen at all.
**Changed:** `ProjectileView` treats the muzzle tip as the previous position on the first frame, so a shot is born with a streak. The tracer rod is clipped so it never reaches back past the muzzle (it was drawn its full length behind the tip, over the turret). Per-look flight height: shells 0.87 (cannon), tracers 0.82 (the lower coax). Tracer 0.035 × 0.3 u. `PrimitiveTankModel`: small round muzzle brake on the coax.
**Not changed (explained):** close to a crate the shell's whole flight is shorter than one tick (1.5 u at 90 u/s), so it is drawn for at most one frame; the hit is registered correctly. Impact feedback is M6; a placeholder impact flash offered to Brendan.
**Acceptance:** throwaway slowed-MG close-up (reverted): a round emerges from the coax brake with nothing over the turret; the stream passes behind the cannon's brake with correct depth.

## 2026-11-20 · M3-3 follow-up 2 · Shot tuning
**Why (Brendan):** impacts and the single-shell read are good; shell too bright; MG streaks too long (no gap between one round and the previous round's streak); cannon shell a bit slow; shell streaks disappear within a certain radius of an obstacle.
**Changed:** shell olive drab (#4b5320) with a dark steel band and steel nose. Streak now covers the distance the shot moved on screen since the last frame instead of velocity × frame time: the velocity is zero while a hit shot is parked, yet the view still carries it the last 1–2 u to the surface, which is why the streak vanished near obstacles. Tracer streaks half length, capped 1 u; tracer rod 0.4 u. Cannon projectile 70 → 90 u/s (GDD §4).
**Tests:** two projectile tests now derive from the def's speed instead of hard-coding 70 u/s. 301 total.
**Open question:** by the numbers MG rounds are 10 u apart (100 u/s, 10 rounds/s) and a streak is ~1.7 u at 60 fps, so ~7 u gaps; if the stream still looks continuous, a screenshot would show whether the frame rate or frame timing is off.
**Acceptance:** throwaway slowed-shell build (reverted) shows the darker shell, nose leading. Streak behaviour needs Brendan's eyes.

## 2026-11-20 · M3-3 follow-up · Shots reach the surface; shell model; motion streak
**Why (Brendan's playtest):** shots at a crate stopped short of it (closer near its corners); the cannon shell looked like several tracers; shells were plain boxes.
**Causes:** (1) a hit moved the shot to the impact point and removed it in the same tick, so the interpolating renderer never drew that last position: shots vanished up to two ticks of travel early. Near corners the hit came earlier in its final tick, so the gap looked smaller. (2) A 0.34 u shell moving ~1.2 u per 60 Hz frame is seen as a row of copies (hold-type displays strobe fast short objects). (3) Placeholder box.
**Changed:** `Projectile` parks at the impact point for one tick after a hit (`hit` → `spent`, zero velocity, no cast) before the Simulation removes it (T-87); `Projectile.origin`. `ProjectileView` rebuilt: prototype-style shell (brass body, pointed nose, dark driving band) or self-lit tracer rod, tip at the front of the collision circle, plus a translucent motion streak one frame's travel long, capped at 3 u and never past the muzzle (T-88). Shared materials per scene.
**Tests:** 2 new (301 total): a hit parks for exactly one tick at the impact point (previous = current) then is spent; the impact event fires once and the shot is gone the tick after.
**Acceptance:** throwaway builds (reverted): close-up auto-fire shows the MG tracer with its streak leaving the coax; a slowed shell shows body, band and nose leading out of the barrel. Crate impacts and the streak at real frame rates need Brendan's eyes.

## 2026-11-20 · M3-3 · Projectiles
**Built:**
- `PhysicsWorld.castCircle(from, to, radius, ignore)` → `CastHit { body, point, normal, fraction }`; Rapier implementation via `castShape` with a ball, the move as velocity and time-of-impact limit 1 (so ToI = fraction of the path). Fake returns no hits.
- `Projectile` entity (owner, weapon def, constant velocity, age): `step(dt, cast)` → flying / hit (stops at the impact point) / expired. `WeaponDef.projectile` gains `lifetime` (2 s) and `look` (shell / tracer, T-86).
- `Simulation`: each shot spawns a projectile at the muzzle; phase 7 advances every projectile the same tick (so it leaves the muzzle at once), casting while ignoring the shooter's body (the coax MG's muzzle sits over the shooter's own hull). `ProjectileImpact { projectile, weapon, target | undefined (wall), point, normal }`. `PhysicsBridge.bodyOf` / `entityOf`.
- `ProjectileView`: brass shell or self-lit tracer streak, tip at the sim position, at barrel height, materials shared per look (T-85).
- 12 new tests (299 total): `Projectile` with real Rapier (9: speed, lifetime, wall impact point and normal, no tunneling through a 0.2 u plate at 1.7 u/tick, MG doesn't hit its own tank, hits and names a tank, **a shot past a 45°-turned tank's corner misses**, stops at and names a crate, 30 MG rounds → exactly 30 impacts and none linger); `castCircle` (3: radius counts, fraction, ignored body).
**Trade-offs:** T-84, T-85, T-86.
**Acceptance:** planted bug (no owner exclusion): the self-hit test failed; restored. Throwaway auto-fire build (reverted): tracers stream from the coax toward the aim point; console clean.
**Issues:** two test-timing slips of mine: rounds still in flight at the end of a 3 s run (fixed by running 3.5 s, after the MG has overheated and stopped).

## 2026-11-20 · M3-2 · Weapons and limiters
**Built:**
- `combat/WeaponDef.ts` (designer terms; `ReloadLimiterDef`, `HeatLimiterDef`), `defs/weapons.ts`: `CANNON` (50, 70 u/s, r 0.07, 1.5 s reload, breaks cover), `MACHINE_GUN` (3, 100 u/s, r 0.04, 1° cone, 0.1 s cadence + heat: 30 rounds, 0.25/s, re-arm 30%), `INSURGENT_CANNON` (12, 3° cone, 2.4 s).
- `limiters/FireLimiter.ts` (interface: `canFire`, `onFired`, `update(dt, triggerHeld)`, `describe` for the HUD, `snapshot`), `ReloadLimiter`, `HeatLimiter` (cools when released or locked out, T-81). `Weapon` (all limiters must allow; at least one required). `WeaponMount` + `Shot`.
- `VehicleDef`: `turret.pivotForward` (−0.05, also used by the view) and `weapons` (slot, weapon, muzzle offset). Player: cannon (primary, muzzle 1.65 ahead) + coaxial MG (secondary, 0.9 ahead, 0.2 left); insurgent: cannon only.
- `Vehicle.fireWeapons` (tick phase 6): limiters advance, held triggers fire, muzzle = turret pivot + mount offset along the turret, heading = turret + spread from the sim `Rng` (none drawn for accurate weapons, T-83). Turret now aims from its pivot (T-82). `ShotFired { shooter, slot, weapon, origin, heading }`. Snapshot includes limiter state.
- Input: `KeyboardMouseDevice` remembers presses since the last read; `FireLatch` keeps a fire press until a tick consumes it (frames with no tick), wired in `main.ts` (T-56).
- 29 new tests (287 total): `ReloadLimiter` (3: exactly 90 ticks for 1.5 s), `HeatLimiter` (5), `Weapon` (6: two limiters, MG 6-tick cadence, 30 rounds then next shot exactly 168 ticks later, cannon every 90 ticks), vehicle firing (6: muzzle positions, turret-relative muzzles, spread cone, spread determinism, insurgent loadout), `FireLatch` (3), weapon def guards (6: whole-tick timings).
**Trade-offs:** T-81, T-82, T-83; T-56 updated.
**Acceptance:** planted bug (fire when *any* limiter allows): 4 tests failed; restored. No visible change in the game yet (projectiles are M3-3).
**Issues:**
- My first MG test assumed the lockout started at tick 180; the 30th round fires on tick 174 (rounds every 6 ticks from 0), so the next shot is correctly at 342. Rewrote it to pin exact ticks.
- The turret-relative muzzle test exposed that the turret aimed from the hull centre, not its pivot; fixed in the sim (T-82).
- New follow-up: barrel bob idea, undecided (Brendan).

## 2026-11-20 · M3-1 · Turret
**Built:** `TurretDef` (traverse rate, spin-up, snap angle, minimum aim distance) in `VehicleDef`; player 4.0 rad/s, 0.05 s, 1°, 1.2 u; insurgent 1.8 rad/s. `Turret` (sim): stabilised world heading, previous heading for interpolation, spin-up then constant-rate traverse the short way round, snap within the snap angle, aim points closer than the minimum ignored; snapshot. `Vehicle.turret`, `aimTurret` as tick phase 5 (after physics). `VehicleCommand.aimPoint` optional (T-80): `intentToCommand` no longer remembers a last aim point. `TankView` turns the model's turret by the interpolated world heading minus the drawn hull heading; views now get `FrameTiming { seconds, alpha }` (alpha 1 with `?interp=off`).
**Tests:** 12 new (258 total): `Turret` (8: hold, spin-up of exactly 3 ticks, traverse time, snap, short way round, minimum distance, re-spin-up per new aim, previous heading), turret on a vehicle (stabilised while the hull pivots; turns to the command's aim), def guard that every timing is a whole number of 60 Hz ticks (2, plan D13). `intentToCommand`: no aim → no aim point.
**Trade-offs:** T-80.
**Acceptance:** throwaway builds with a parked insurgent aiming at a fixed point (reverted): hull north aiming east shows the barrel pointing right; hull east aiming north shows it pointing up-screen. Mouse and right-stick aiming need Brendan.
**Issues:** headless Chrome under virtual time fires too few animation frames for the turret to finish traversing in a moving scene; static variants with the catch-up cap lifted gave a clean check instead.

## 2026-11-20 · M3 · Plan approved
**Saved:** [`plans/m3-weapons.md`](plans/m3-weapons.md) (D1–D13). GDD §3–§5 updated to the plan's starting values: whole-tick, round numbers instead of the prototype's (MG 10 rounds/s, 30 rounds to overheat, 0.25/s idle cooling, re-arm 30%; cannon reload 1.5 s to try; turret 4.0 rad/s with 0.05 s spin-up; shells 70/100 u/s). Timings must be whole 60 Hz ticks (the prototype's 0.095 s MG interval would alternate 5- and 6-tick gaps). Both armor face rules will be built and compared in play. Backlog: realistic armor (angle of impact, ricochets).

## 2026-11-20 · M2 · Milestone complete
**Changed:** default gamepad scheme `tank` → `triggers` (Brendan's pick: RT/LT drive, left stick X turns, RB/LB fire); GDD §3 controls and architecture §7 updated. README status.
**M2 done-when:** drive with keyboard and Xbox controller ✅ (Brendan) · treads never visibly enter obstacles ✅ (tests: worst overlap ~0.005 u; Brendan: only the barrel clips, planned as M3-7) · locomotion unit-tested ✅ (`TrackedLocomotion`, gearbox, defs) · CI green ✅. 246 tests.
**Carried into M3:** M3-7 barrel retraction (T-75); `VehicleSnapshot` gains health, heat and reload state; input latching for fire buttons (T-56); `VehiclesCollided` consumed by M6 juice; circling insurgent replaced in M4 (T-49).

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
