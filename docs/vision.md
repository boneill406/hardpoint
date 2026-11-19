# Vision — Hardpoint (working title)

_Accepted — 2026-11-18_

## One-liner
A browser-based 3D arcade combat game: pilot a customizable war machine through tight, room-based fights where **where you stand matters as much as what you shoot.**

## Inspirations
- **Wii Play Tanks:** readable arenas, deliberate shots, positioning over reflexes.
- **Robokill:** room-clearing pace, loot and upgrade loop between fights.
- **Halo's Mantis:** the fantasy of a heavy, customizable walker.

## Design pillars
Every feature should strengthen at least one pillar. A feature that serves none is scope creep.

1. **Position is power.** Directional armor, cover and flanking turn every engagement into a positioning puzzle. Front armor is a shield, side and rear armor are openings, and cover can be broken.
2. **Heavy and readable.** Machines feel weighty (hull-relative driving, turret traverse, recoil, impact) but the battlefield stays easy to read from a high camera. Every threat is visible and telegraphed. Hits *land*.
3. **Few weapons, each distinct.** A small set of weapon classes with clear roles, improved through tiers and upgrades, never near-duplicates. Weapons occupy distinct slots (primary/secondary and beyond).
4. **Your machine, your build** _(post-slice)._ Chassis, weapons and armor are modular parts. Customization starts simple and grows into detailed construction, all on one shared chassis framework (treads now, legs later).

## Guiding principles (process)
- **Depth before breadth.** Make one thing feel great before adding the next.
- **Gameplay before art.** Placeholder primitives until the core is fun.
- **Tested core.** Game logic is unit-tested and independent of rendering.

## Tone
Grounded, stylized military sci-fi. Not grimdark, not cartoonish. Stylized but detailed 3D.

## Platform and audience
Desktop browsers, keyboard + mouse or Xbox controller. A personal project, possibly shared on itch.io. Single player first; co-op later (ADR-0001).

## Vertical slice
One tracked chassis, one loadout (cannon primary + machine gun secondary), one enemy type (insurgent tank with pathfinding AI), one arena.

- **Mode:** wave survival. Escalating waves of enemy tanks; **win** by clearing the final wave; **lose** when your tank is destroyed; instant restart.
- **Success test:** a 3–5 minute run that is fun to replay.

## Game modes (future)
Modes share the same vehicles, combat and AI; they differ in spawning and win conditions.
- **Wave survival** (slice): one arena, escalating waves.
- **Room clearing** (Robokill-style): connected rooms, each with a fixed set of enemies; clear every room to win.
- Others later (e.g., expeditions tied to the garage loop).

## Non-goals (for now)
- Online/cloud multiplayer
- Mobile/touch
- Large weapon catalogs, cosmetic skins
- Story or campaign
- Second faction (aliens) before the insurgent faction is fun
