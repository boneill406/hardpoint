# M2 Plan — Driving

_Approved by Brendan 2026-11-19. Milestone definition: [`milestones.md`](../milestones.md) § M2. Status: **in progress** (update the task table as work lands)._

**Goal:** driving around the arena feels at least as good as the prototype.
**Done when:** you can drive with keyboard and Xbox controller; treads never visibly enter obstacles; locomotion is unit-tested.

## Decisions (approved)
| # | Question | Decision |
|---|---|---|
| D1 | How vehicles move and collide | **Rapier dynamic bodies with a traction-limited drive.** Each tick `TrackedLocomotion` moves the vehicle's velocity toward the commanded one, with each change capped by engine force (forward/back), braking, and track grip (sideways). Rapier resolves contacts, so a stronger tank shoves a weaker one, a tank flush against a wall can still pivot, and angled approaches slide along walls. The sim emits `VehiclesCollided { a, b, impulse }` for clash juice (M6). Rejected: a kinematic character controller, which handles translation only, so a tank flush against a wall couldn't rotate |
| D2 | `PhysicsWorld` interface (T-24) | Extend only for M2: static boxes, vehicle bodies (create, set velocity, read transform), collider removal, collision events. Ray and shape casts wait for M3. Heading ↔ Rapier conversion (`rotation = −heading`) lives only in `RapierPhysicsWorld` |
| D3 | Handling (GDD §3) | Top speed **7.0 u/s** (prototype 8.4 felt too fast), reverse **60%**, turn **2.2 rad/s** with a 0.1 s ramp, pivot in place allowed. **Revised after first drive (too fluid):** a **gear-change pause** when switching between forward and reverse. Brendan then tuned the player tank in play to **0.4 s** to top speed, **0.25 s** to stop, **0.15 s** shift, **2.0 rad/s** turn (insurgent keeps 0.5 / 0.15 / 0.2). Engine force = `mass × topSpeed / accelTime`, so power differences come from mass and acceleration. Starting values; tune by editing `defs/vehicles.ts`. The look of inertia (hull pitch on accelerate/brake, rock on gear change) moves into M2-6 |
| D4 | Hull footprint | **2.4 u long × 1.6 u wide** (approximately right per the prototype; adjust as needed). In `VehicleDef`; the tank view (M2-6) matches it |
| D5 | Obstacles | **Walls belong to `Arena`** (static colliders, not entities). **Pillars and crates are `Prop` entities** (`destructible` false/true) so M3 can destroy crates through the normal lifecycle. **Gates are data** (position and facing on a wall); walls stay continuous |
| D6 | Input | **Bindings are data** in `src/input/bindings.ts` (keys by `KeyboardEvent.code`, pad buttons and axes). **The last-active device wins.** Intent is sampled once per frame and applied to every tick that frame. Gamepad schemes switchable with `?pad=`: `tank` (GDD: left stick Y throttle, X turn), `direct` (left stick points where to go), `triggers` (RT forward, LT reverse, left stick X turn; fire on bumpers). Mouse aim via a `screenToGround` callback wired by `main.ts`; stick aim becomes a point at a fixed distance. Aim is carried but unused until M3. In-game rebinding stays out of scope (GDD §10) |
| D7 | Input tests | Pure mapping functions (keys → intent, deadzones, inversion, schemes) tested in `tests/input/`, an exception to "tests mirror `src/sim/`" like T-14. Device and browser glue isn't unit-tested |
| — | Not doing | Double-tap or Shift speed gears: considered and dropped as unnecessary |

## One tick after M2
```
Simulation.tick(commands)
  1. save previousTransform for every entity
  2. each Vehicle: command = controller.decide({ commands, tick, vehicle })
  3. each Vehicle: velocities = locomotion.step(command, motion, dt)   (traction-limited)
  4. physics: set body velocities → step(1/60) → read transforms back
     (M2-1 and M2-2 integrate without physics; M2-3 hands this to Rapier)
  5. collision events → VehiclesCollided
  6. apply removals; tick + 1
```

## Tasks (build order)
| Order | Task | Branch | Status |
|---|---|---|---|
| 1 | M2-1 `Vehicle`, `Locomotion` (interface), `TrackedLocomotion`, `Controller` (interface), `VehicleDef` + `defs/vehicles.ts` (player and insurgent), `VehicleFactory`, `ScriptedController` (debug). Deletes `DebugMover`; placeholder `VehicleView`. `Vehicle.snapshot()` adds velocities | `m2-1-vehicle` | ✅ |
| 1b | M2-1 follow-up: gear-change pause, sharper braking, slower pull-away (after Brendan's first drive) | `m2-1-gear-shift` | ✅ |
| 2 | M2-2 `PlayerIntent`, `bindings.ts`, `KeyboardMouseDevice`, `GamepadDevice` (schemes), `InputManager`, `PlayerController`. First drivable build; determinism test drives a player vehicle with its command stream | `m2-2-input` | ✅ |
| 3 | M2-4 `ArenaDef` in `defs/arenas.ts`: 46×46 walls, 7 pillars, 14 crates, 3 gates, player start; rendered from the def (clears T-20; grid behind `?grid=on`) | `m2-4-arena` | ✅ |
| 4 | M2-3a Static collision: `PhysicsWorld` API (static boxes, vehicle bodies, set velocity, read transform), walls and props as colliders, Rapier integrates vehicles (replaces `Vehicle.integrate`), heading ↔ Rapier conversion. Also: `debugParams` warns on unrecognised values | `m2-3a-static-collision` | ✅ |
| 4b | M2-3b Tank vs. tank: shoving by mass and traction, contact events → `VehiclesCollided { a, b, impulse }`, determinism with contacts | `m2-3b-tank-contacts` | ✅ |
| 5 | M2-6 Primitive tank view: hull, two tracks, turret and barrel (turret fixed forward until M3), sized to the footprint. **Plus hull pitch** (back on accelerate, forward on brake, rock on gear change), computed in the render layer from the sim's velocity change (pulled forward from M6) | `m2-6-tank-view` | ✅ |
| 6 | M2-5 Camera: smoothed, frame-rate-independent follow of the interpolated player; tune and record T-19 values in the GDD | `m2-5-camera` | ✅ (preset pick pending) |

_M2-3 was split in two (Brendan, 2026-11-19): collision is the riskiest task in M2, and a smaller change is easier to tune and review, with a playable checkpoint (no driving through obstacles) in between._

## Tests
| Area | Behaviors |
|---|---|
| `TrackedLocomotion` | Reaches top speed in the accel time, never above it; analog throttle gives proportional speed; reverse capped at 60%; stops within the stop time; turn ramps to 2.2 rad/s, positive = clockwise; pivots in place; sideways sliding decays at the grip limit |
| `Vehicle` / `VehicleFactory` / defs | Built from a def with its numbers; moves along its heading; `snapshot()` includes velocities; player def grip can hold a full-speed turn |
| `Controller` | Simulation asks each vehicle's controller once per tick; `PlayerController` uses its player's command, a missing command means idle |
| Static collision, M2-3a (real Rapier) | Stops at a wall face within skin tolerance; at 45° the **corner** touches the wall; angled approach slides; a tank flush against a wall can pivot away; can't pass through a crate or pillar |
| Tank contacts, M2-3b (real Rapier) | Two tanks don't overlap; the stronger tank wins a head-on shove; collisions emit `VehiclesCollided` with an impulse |
| Arena def | Obstacles inside the walls; gates on walls; player start clear; no overlaps |
| Determinism | Same seed + scripted commands, including wall and tank contacts, give identical snapshots |
| Input (`tests/input/`) | W and D give throttle 1, turn +1; opposite keys cancel; stick deadzone; stick Y inverted; each `?pad=` scheme maps as specified |

## Trade-offs to record (T-50 onward)
Traction-limited dynamic bodies (shoving; small solver penetration) · last-active device wins · intent sampled per frame · walls as non-entities · handling values unplaytested · `ScriptedController` and the debug scene in `main.ts` until M2-2.

## Out of scope
Turret aiming, weapons, damage (M3) · enemies, AI (M4) · tread marks, clash juice (M6) · pause (M5) · HUD.
