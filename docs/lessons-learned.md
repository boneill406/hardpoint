# Lessons Learned — Prototype (mantis_bp)

_Written 2026-11-18. Source: `mantis_breach_v0_1_0` (tank build, ~2,100 LOC, 10 commits) plus two archived builds (walker v0.1.0, cancelled 2D build). The prototype is reference only; nothing here is binding except where a later doc adopts it._

## What felt good — keep

| Element | Why it works | Carry forward as |
|---|---|---|
| Hull-relative tank driving + independent mouse aim | Readable, weighty, distinct from twin-stick shooters | Default control scheme for tracked chassis; control scheme becomes a property of the locomotion module |
| High-angle camera (between top-down and isometric) with smoothed follow | Shows the 3D style while keeping the arena readable | Camera spec in GDD |
| Directional armor (front hits deal ~⅔ damage) | Positioning and flanking matter — the tactical layer | **Design pillar** |
| Cannon + machine gun pairing | Clear role split: slow/heavy/cover-breaking vs. fast/heat-limited/light | The slice's single loadout (primary + secondary slot) |
| Small feedback details: tread marks, MG heat glow, brief turret spin-up delay | Cheap, high perceived quality | Keep; budget a "juice" pass per milestone |

## What didn't work — and why

| Problem | Root cause | Fix in the restart |
|---|---|---|
| Code became unmanageable; 2D build abandoned | No architecture, no review, AI-generated code accepted without structure; `game.js` held scene, map, input, collision, damage, HUD and loop | Docs-first process, ADRs, module boundaries, lint/format/CI, code review in Claude Code |
| Shells "hit" empty space near the tank | Hit test used a world-axis-aligned box around the rotated tank model (`Box3.setFromObject` + padding) — at 45° that box is far larger than the hull | Oriented collision shapes owned by the simulation, never derived from render meshes |
| Treads clip into obstacles | Player collides as a circle (r = 0.78) but the hull is ~2.4 long (half-length 1.21) | Collision shape matches the chassis footprint (oriented box/capsule) |
| Explosions, smoke trails, crate destruction feel clunky | Ad-hoc meshes per effect (spheres, tori), new geometry/material per shot, no particle system | Pooled VFX system; VFX polish is its own backlog item, not mixed with gameplay code |
| Walker legs looked wrong | Legs swung on a sine wave with no foot planting → feet slide | Cosmetic procedural legs: 2-bone IK + planted feet over a simple body (already planned) |
| Game state lived inside Three.js objects (e.g., hull heading = `chassis.rotation.y`) | No sim/render separation | Pure-TS simulation; renderer reads sim state each frame |
| Two separate projectile systems (player vs. enemy) with different hit logic | Features bolted on per entity | One projectile/damage system for all factions |
| One shared `obstacles` array for crates, pillars and the enemy (`isEnemy` flag) | No entity model | Explicit entity/component model |
| Frame-rate-dependent updates, `Math.random()` everywhere | Variable `dt` loop | Fixed timestep + single seeded RNG (also required for co-op) |
| Enemy gets stuck behind cover | Greedy steering (7 probe headings), no pathfinding | Grid/navmesh pathfinding + simple behavior states |
| Restart required page refresh; Three.js from CDN; README version ≠ folder version | No build, no game-state lifecycle | Vite build, pinned dependencies, explicit game states (menu/play/dead/restart) |

## Scope lesson (cancelled 2D build)
Six weapons, two factions, mass/power budgets, shields, boost, pickups and objectives in ~100 lines — breadth before any one thing felt good. The tank build succeeded because it went deep on one vehicle and two weapons. **Depth before breadth** is the rule for the slice.

## Ideas parked (not slice scope)
- Mass/power budget as the constraint for chassis customization (from 2D build)
- Weak weapons push light obstacles instead of damaging them (physics-driven cover)
- Credits/pickups — return with the garage/meta loop
- Aliens as a second faction

## Decisions taken from this review
- Slice loadout: cannon (primary) + machine gun (secondary)
- Directional armor: pillar. Destruction: simple crates break apart; per-chunk chipping cut
- Credits cut from slice; garage-related values treated as unlimited
- Slice enemy: insurgent-reskinned enemy tank with real pathfinding and AI
- Slice arena: single room
- Co-op: architecture stays co-op-ready; no netcode in slice (ADR-001 to record)
- New repo; working title **Hardpoint**
