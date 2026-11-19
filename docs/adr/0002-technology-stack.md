# ADR-0002: Technology stack — Babylon.js + Rapier + TypeScript

- **Status:** Accepted. Physics row superseded by [ADR-0005](0005-rapier-2d-physics.md) (`rapier2d-compat`).
- **Date:** 2026-11-18

## Context
Browser-first 3D arcade game. Future features include swappable chassis (walker legs with IK), pushable/destructible cover, LAN co-op, a garage with modular construction, a Blender → glTF asset pipeline, and polished visual effects. Priorities stated by the developer:

- Least hand-built tooling possible, especially for visual effects.
- Object-oriented design.
- Development driven largely through Claude Code (text/code-first workflow).
- Performance on an M1 MacBook Air is not a concern.

## Decision

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Build / dev server | Vite |
| Rendering, effects, audio, asset loading | **Babylon.js** (`@babylonjs/core`, ES modules) |
| Physics / collision | **Rapier** (`@dimforge/rapier3d`), used only from the simulation layer |
| Unit tests | Vitest |
| Lint / format | ESLint (with import-boundary rules) + Prettier |
| Package manager | npm |
| CI | GitHub Actions (lint, typecheck, test, build on push/PR) |
| Input | Browser Gamepad API (Xbox controllers, standard mapping) + keyboard/mouse |
| Level data (slice) | Typed TypeScript definitions. Blender-authored levels via glTF in a later milestone |

## Alternatives considered

| | Why not chosen |
|---|---|
| **Three.js** | Proven by the prototype; largest ecosystem; lighter. But effects, inspector, audio, UI and animation must be assembled from third-party libraries or hand-built. Frequent breaking releases. Strong runner-up. |
| **Godot 4 (web export)** | Excellent editor. But C# can't export to the web (GDScript only), the download is large, the node model fights sim/render separation, and editor-centric work suits Claude Code less well. |
| **Babylon's bundled Havok physics** | Attaches physics to scene meshes, coupling gameplay to rendering (see ADR-0003). Rapier runs in the simulation instead. |

## Consequences
- ➕ Built-in particle system, preset effects and the Node Particle Editor reduce hand-built VFX work.
- ➕ Inspector for live scene debugging. Built-in audio, asset management and animation.
- ➕ Class-based API fits the OOP design (ADR-0004).
- ➕ Strong backward-compatibility culture, so upgrades are lower risk.
- ➖ Smaller community and fewer examples than Three.js. AI-generated Babylon code may need more review.
- ➖ Larger bundle (acceptable for desktop browsers).
- ➖ Babylon's conventions encourage logic on scene objects. Guarded by ADR-0003.

## Revisit when
A Babylon limitation blocks a planned feature, or bundle size becomes a real problem (e.g., mobile becomes a target).
