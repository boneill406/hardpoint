# Hardpoint

[![CI](https://github.com/boneill406/hardpoint/actions/workflows/ci.yml/badge.svg)](https://github.com/boneill406/hardpoint/actions/workflows/ci.yml)

A browser-based 3D arcade tank combat game where **where you stand matters as much as what you shoot**. Inspired by Wii Play Tanks, Robokill and Halo's Mantis. _Hardpoint_ is a working title.

**Status:** building the vertical slice: one tracked tank, a cannon and a machine gun, five waves of enemy tanks in a single arena. The project scaffold (milestone M0) is complete; nothing is playable yet. See [milestones](docs/milestones.md).

## Quick start

Requires **Node.js 22.12 or later** (CI uses the version in [`.nvmrc`](.nvmrc), currently 26) and npm.

```sh
npm ci          # install the exact versions in package-lock.json
npm run dev     # start the dev server, then open the printed URL
```

You should see the arena floor from the game's high-angle camera. The browser console logs `Physics ready: Rapier 2D`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Rerun tests on every save |
| `npm run lint` | ESLint, including the architecture boundary rules |
| `npm run typecheck` | TypeScript, no output |
| `npm run format` / `format:check` | Prettier: rewrite / check only (Markdown is skipped) |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, format check, typecheck, tests and build on every push and pull request.

## Architecture in one minute

```
input ──PlayerIntent──▶ src/sim  (pure TypeScript, fixed 60 Hz) ──state + events──▶ render (Babylon.js), ui
```

- **Gameplay lives in `src/sim/`** and never imports Babylon, browser APIs or the other layers. It changes only through `Simulation.tick(commands)`, uses a seeded `Rng` instead of `Math.random()`, and gets collision from Rapier 2D.
- **Rendering is read-only:** it interpolates simulation state and reacts to simulation events (explosions, sounds, HUD).
- **Lint enforces the boundary,** and a test guards the lint rules themselves, so CI fails if they are broken or weakened.

Why: the prototype mixed gameplay into the renderer and became untestable (see [lessons learned](docs/lessons-learned.md)). This split also keeps co-op possible later.

```
src/
  sim/      game rules, physics adapter, AI, defs (content as data)
  render/   Babylon scene, views, camera, VFX, audio
  input/    keyboard/mouse and Xbox controller → PlayerIntent
  ui/       HTML HUD and menus
  app/      main.ts: wiring and the frame loop
tests/      mirrors src/sim/; tests/tooling/ guards the lint config
```

## Tech stack

TypeScript (strict) · Vite · [Babylon.js](https://www.babylonjs.com/) (rendering, effects, audio) · [Rapier 2D](https://rapier.rs/) (physics, simulation only) · Vitest · ESLint + Prettier · GitHub Actions.

## Documentation

| Doc | Read it for |
|---|---|
| [Vision](docs/vision.md) | Pillars and scope guardrails |
| [Game design (GDD)](docs/gdd.md) | The slice: controls, tuning values, acceptance criteria |
| [Architecture](docs/architecture.md) | Layers, classes, folder layout, one frame step by step |
| [Milestones](docs/milestones.md) | M0–M7 tasks and the post-slice backlog |
| [ADRs](docs/adr/README.md) | Major decisions and why (stack, sim/render split, Rapier 2D…) |
| [Trade-offs](docs/tradeoffs.md) | Every deliberate trade-off (`T-nn`) and when to revisit it |
| [Dev log](docs/dev-log.md) | Per-task notes, issues, open follow-ups, environment quirks |
| [Lessons learned](docs/lessons-learned.md) | What went wrong in the prototype |
| [CLAUDE.md](CLAUDE.md) | Coding rules and workflow (also read by Claude Code) |

## Workflow

One branch per milestone task (`m2-3-collision`), commits prefixed with the task ID (`M2-3: …`). A task is done when lint, typecheck, tests and build pass, docs are updated, and its dev-log entry is written. Details in [CLAUDE.md](CLAUDE.md).
