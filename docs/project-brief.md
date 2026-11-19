# Project Brief — Decisions So Far

_Last updated: 2026-11-18_

> **Historical document.** This is the original brief. Its open questions have since been resolved. Current decisions live in `vision.md`, `gdd.md`, `architecture.md`, `milestones.md` and `adr/`.

## Concept
A browser-based 3D arcade combat game. Original pitch: a customizable **Halo Mantis–style walker** dropped into the gameplay style of **Robokill** (top-down/isometric room-clearing), with the readable, tactical feel of **Wii Play Tanks**. Enemies: aliens or insurgents.

## Background
- A prior prototype was built with Codex (free tier) without a mature dev process.
- Codex struggled with walker logic, so the prototype pivoted to a **tank** — which turned out well.
- The prototype is **reference only**: concept and direction may be salvaged; its tech stack and design decisions are not binding.
- Development is restarting (Nov 2026) with proper upfront planning.

## Design Direction (stated so far)
- **Camera:** high angle, between top-down and isometric.
- **Controls:** WASD movement; mouse-directed aiming of the upper body/turret.
- **Combat:** fast-paced, but with meaningful tactical choices.
- **Weapons:** a handful of distinct weapon classes with tiers and upgrades (per-weapon and armor). No sprawl of near-duplicate weapons or skins. Distinct weapon slots.
- **Customization:** starts simple, grows into detailed construction over time.
- **Meta loop (exploring):** persistent garage between missions/expeditions.
- **Visuals:** stylized but detailed 3D. Walker should have visible feet.
- **Platform:** browser delivery; development practicality weighs heavily in tool/architecture choices.

## Key Decisions & Working Approach
1. **Walker vs. tank — undecided, but not mutually exclusive.**
   - Movement sits behind a shared **chassis/locomotion interface**. Tank treads, walker legs (and possibly hover later) are swappable modules over the same core.
   - **Walker legs are cosmetic**: gameplay physics is a simple body that moves and rotates (like a tank); legs are procedurally animated on top (2-bone IK, foot planting). This avoids the problem that stalled the prototype.
   - Proposed: vertical slice uses the **tank** (proven fun); walker chassis is a later milestone.
2. **Simulation separated from rendering** so game logic is unit-testable and chassis-swappable.
3. **Art doesn't block gameplay.** Placeholder primitives until the core is fun. Stylized low-poly / kitbashed parts are the realistic target given limited Blender time. Blender → glTF pipeline is its own milestone.
4. **Scope:** first target is a **vertical slice** — one chassis, one weapon class, one enemy type, one arena — that's fun to play. Garage/meta systems come after.

## Process Plan
1. Upload prototype → **lessons-learned.md** (what felt good, what was hard and why, ideas to keep, pitfalls)
2. **vision.md** — one page, 3–4 design pillars
3. **gdd.md** — vertical slice scope only
4. **adr/** — engine (e.g., Three.js / Babylon.js / Godot web export), physics, project structure, asset pipeline
5. **milestones.md** + backlog → move into Claude Code with docs in the repo's `/docs` and a `CLAUDE.md`
6. Testing (unit tests for game logic) and CI (lint/build) from the start

## Open Questions
- Walker vs. tank as the long-term core identity?
- Enemy faction: aliens, insurgents, or both?
- Mission structure: discrete rooms (Robokill) vs. open arenas vs. expeditions?
- Engine/stack choice (ADR pending).
- How much time to invest in Blender vs. sourcing/kitbashing assets?
