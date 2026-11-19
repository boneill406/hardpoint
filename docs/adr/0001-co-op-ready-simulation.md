# ADR-0001: Co-op-ready simulation, no netcode in the slice

- **Status:** Accepted
- **Date:** 2026-11-18

## Context
Co-op is wanted eventually, but how is undecided. Options range from couch co-op (same screen, keyboard/mouse + Xbox controller) to LAN play hosted on the developer's PC. Cloud hosting is out of scope. Bluetooth isn't viable: browsers expose Bluetooth for peripherals, not peer-to-peer game sessions.

Adding multiplayer to a game that wasn't built for it usually means rewriting the core loop. Designing for it upfront is cheap if it's limited to a few rules.

## Decision
The simulation follows these rules from the first commit:

1. **Fixed timestep.** The simulation advances in fixed 60 Hz ticks, independent of render frame rate. Rendering interpolates between the last two ticks.
2. **Commands in, state out.** Players (local or remote) and AI affect the world only through `VehicleCommand` objects consumed by `Simulation.tick()`. Nothing outside the simulation mutates simulation state.
3. **Seeded randomness.** All gameplay randomness comes from one seeded `Rng` owned by the simulation. `Math.random()` and wall-clock time are banned inside `src/sim/` (lint rule).
4. **N players from day one.** The simulation assumes a list of players, even though the slice has one.
5. **Future network model: host-authoritative.** When co-op arrives, the host runs the simulation; clients send commands and receive state snapshots. This needs only *local* determinism (for tests and replays), not bit-exact cross-machine determinism, so ordinary `Math` functions are allowed.

No networking code is written in the vertical slice.

## Alternatives considered
- **Ignore co-op until later.** Rejected: retrofitting rules 1–3 means touching every system.
- **Lockstep networking (all peers run the sim).** Rejected for now: requires cross-platform bit-exact determinism (no `Math.sin`, deterministic physics build), which is a heavy constraint for a speculative feature.

## Consequences
- ➕ Couch co-op and LAN co-op both remain cheap to add.
- ➕ Rules 1–3 also make the simulation testable and replayable.
- ➖ The render layer has to interpolate between ticks (small, one-time cost).
- ➖ Developers must route all randomness through `Rng` (enforced by lint).

## Revisit when
Co-op work begins. At that point, choose between couch and LAN co-op and write the networking ADR.
