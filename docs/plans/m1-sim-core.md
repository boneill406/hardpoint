# M1 Plan — Simulation core

_Approved by Brendan 2026-11-19. Milestone definition: [`milestones.md`](../milestones.md) § M1. Status: **in progress** (update the task table as work lands)._

**Goal:** the fixed-step engine room, fully tested, with a debug view.
**Done when:** a test entity moves at a fixed speed and renders smoothly at any frame rate; all core classes have tests.

## Decisions (approved)
| # | Question | Decision |
|---|---|---|
| D1 | Test entity for M1 | Temporary `DebugMover` in `src/sim/debug/`, deleted in M2 when `Vehicle` exists. Not an early `Projectile` |
| D2 | Event delivery | **Buffered:** `emit` queues during ticks; `flush()` delivers after the frame's ticks. Render code never runs mid-tick |
| D3 | Heading convention | **0 = +z (up-screen); positive turns toward +x (clockwise seen from above); forward = `(sin h, cos h)`.** Matches Babylon `rotation.y`; Rapier conversion lives in `RapierPhysicsWorld` (M2-3) |
| D4 | Who implements | Claude builds all of M1 (Brendan reviews) |

## One frame after M1
```
requestAnimationFrame (main.ts)
  │ elapsed seconds since last frame
  ▼
FixedClock.advance(elapsed) ──▶ n steps (0..5), alpha (0..1)
  │
  ├─ repeat n: Simulation.tick(commands)
  │     1. copy transform → previousTransform for every entity
  │     2. entities update (M1: DebugMover only)
  │     3. physics.step(1/60)
  │     4. apply deferred removals → queue EntityDestroyed
  │     5. tick count + 1
  │
  ├─ events.flush() ──▶ subscribers (VFX, audio, HUD later)
  ▼
Renderer.render(world, alpha)
  └─ RenderBridge: diff world ids vs views (create/dispose),
     then place each view at lerp(previousTransform, transform, alpha)
```
Interpolation shows the sim up to one tick (16.7 ms) late, in exchange for smooth motion at any frame rate.

## Tasks (build order)
| Order | Task | Branch | Status |
|---|---|---|---|
| 1 | M1-1 Math: `Vec2` (immutable), `angles.ts` (`wrapAngle`, `angleDelta`, `lerpAngle`), heading convention in docs | `m1-1-math` | ✅ |
| 2 | M1-3 `Rng`: mulberry32; `next`, `range`, `int`, `chance`, `pick`; `getState` / `setState` | `m1-3-rng` | ✅ |
| 3 | M1-2 `FixedClock`: accumulator, `alpha`, max 5 catch-up steps then drop time; takes elapsed seconds (never reads a clock) | `m1-2-fixed-clock` | ⬜ |
| 4 | M1-4 `EventBus` + `SimEvents` (`EntitySpawned`, `EntityDestroyed`), typed by event-name → payload map, buffered | `m1-4-event-bus` | ⬜ |
| 5 | M1-5 `Entity` (id, `transform`, `previousTransform`), `World` (ids from 1, `ofType(Class)` in insertion order, deferred `remove`), `Simulation` (`constructor({ seed, physics, populate })`, `tick(commands: Map<playerId, VehicleCommand>)`, `snapshot()`), `VehicleCommand` type, `DebugMover`. Simulation owns physics (resolves T-26) | `m1-5-world-simulation` | ⬜ |
| 6 | M1-7 Determinism: same seed → identical snapshots after 600 ticks; different seed → different. Command-stream part extended in M2-2 | `m1-7-determinism` | ⬜ |
| 7 | M1-6 `render/coords.ts`, `RenderBridge`, `EntityView` interface, `DebugMoverView` (box with a nose); `main.ts` loop; debug URL params `?fps=N`, `?interp=off` | `m1-6-render-bridge` | ⬜ |

## Tests (`tests/sim/core/`, fixed seeds, no real timers)
| Area | Behaviors |
|---|---|
| Vec2 / angles | `fromHeading(0)` → +z; `fromHeading(π/2)` → +x; normalizing zero is safe; `lerpAngle` 170° → −170° passes through 180° |
| Rng | Same seed → same sequence; seeds differ → sequences differ; `range` / `int` stay in bounds over 10k samples; restored state resumes identically |
| FixedClock | 1/120 s twice → 1 step; `alpha` = leftover fraction; 2 s stall → 5 steps, rest dropped; zero/negative elapsed → 0 steps |
| EventBus | Nothing delivered before `flush`; emission order kept; unsubscribe works; `flush` empties the queue |
| World | Ids from 1; `ofType` by class in insertion order; removal deferred to tick end; removing an unknown id is a no-op |
| Simulation | Tick count increments; physics stepped once per tick with 1/60 (fake `PhysicsWorld`); `previousTransform` holds last tick; mover covers speed × 1 s in 60 ticks; one integration test with real Rapier |
| Determinism | As task 6 |

## Trade-offs to record (T-32 onward)
- Buffered events (no mid-tick render code; effects up to one frame late).
- Immutable `Vec2` (fewer aliasing bugs; small allocations, negligible at slice scale).
- `RenderBridge` diffs ids instead of listening to spawn/destroy events (can't desync; O(n) per frame).
- Deferred entity removal.
- Catch-up capped at 5 steps, extra time dropped (brief slow motion instead of a death spiral).
- `DebugMover` as a temporary fourth `Entity` subclass (removed in M2).

## Out of scope
Input, `Vehicle`, `Controller` (M2) · gameplay events (M3+) · `GameMode` (M5). No new dependencies.
