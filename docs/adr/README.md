# Architecture Decision Records

| # | Title | Status |
|---|---|---|
| [0001](0001-co-op-ready-simulation.md) | Co-op-ready simulation, no netcode in the slice | Accepted |
| [0002](0002-technology-stack.md) | Technology stack — Babylon.js + Rapier + TypeScript | Accepted (physics row superseded by 0005) |
| [0003](0003-simulation-decoupled-from-rendering.md) | Simulation decoupled from rendering | Accepted |
| [0004](0004-oop-composition-over-ecs.md) | Object-oriented composition instead of an ECS library | Accepted |
| [0005](0005-rapier-2d-physics.md) | Rapier 2D for simulation physics | Accepted |

**Format:** Context → Decision → Alternatives considered → Consequences → Revisit when. Never edit an accepted ADR's decision; supersede it with a new ADR.

**Pending:** asset pipeline (Blender → glTF), level authoring, co-op networking model.
