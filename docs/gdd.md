# Game Design Document — Vertical Slice

_Hardpoint (working title). Scope: vertical slice only. Accepted — 2026-11-18._
_See `vision.md` for pillars, `architecture.md` for structure._

## 1. Slice summary
The player drives one tracked tank through **5 escalating waves** of insurgent tanks in a single arena. Clear wave 5 to win; lose when your tank is destroyed. A run lasts 3–5 minutes and ends with a summary screen and instant restart.

**Pillar check:** directional armor + breakable cover → *Position is power*. Weighty driving, juice and clear telegraphs → *Heavy and readable*. Cannon + machine gun with distinct roles → *Few weapons, each distinct*.

## 2. Run flow

```
Title ("Press any key / A") → Wave 1 → breather → Wave 2 → … → Wave 5 → Victory summary
                                     ↘ tank destroyed → Defeat summary
Summary → Restart (instant, same arena) | Title
```

| Step | Details |
|---|---|
| Wave start | Banner "WAVE n / 5". Spawn gates glow ~2 s before tanks emerge |
| During wave | Enemies spawn staggered ~1.5 s apart across gates |
| Wave cleared | Last enemy destroyed → "WAVE CLEARED" |
| Breather | ~5 s countdown. Armor repairs (see §4). Destroyed crates stay destroyed |
| Victory | Wave 5 cleared → summary |
| Defeat | Player armor reaches 0 → brief destruction moment → summary |

### Waves

| Wave | Enemy tanks | Notes |
|---|---|---|
| 1 | 1 | Teaches the basics |
| 2 | 2 | First flanking pressure |
| 3 | 3 | Cover starts to break |
| 4 | 4 | Multiple angles at once |
| 5 | 5 | Final test |

Escalation is **count only**. All enemies use the same definition.

## 3. Player tank

| Property | Starting value | Notes |
|---|---|---|
| Armor (health) | 100 | |
| Directional armor | front ×0.65, side ×1.0, rear ×1.25 | Applies to damage the player receives |
| Drive speed | 7.0 u/s | Prototype's 8.4 felt too fast (M2 plan, D3) |
| Reverse speed | 60% of drive speed (4.2 u/s) | Prototype reversed at full speed |
| Acceleration | 0.4 s to top speed; 0.25 s to stop | Inertia; the prototype reached speed instantly. Tuned by Brendan in play (2026-11-19) |
| Gear change | 0.15 s stopped when switching between forward and reverse | Makes direction changes feel mechanical (brake, pause, pull) rather than one smooth swoop. Tuned in play |
| Hull turn rate | 2.0 rad/s, 0.1 s ramp; can pivot in place | Prototype 2.2; tuned in play |
| Mass | 30 | Relative units. Engine force = mass × speed / accel time, so heavier or quicker tanks shove harder |
| Track grip | 40 u/s² sideways | Must exceed speed × turn rate (14) to hold a full-speed turn |
| Hull footprint | 2.4 × 1.6 u (length × width) | Approximate prototype size; adjust as needed |
| Turret traverse | 4.1 rad/s, 0.07 s spin-up delay | From prototype |
| Collision | Oriented box matching the hull footprint; tanks can shove each other | Fixes the prototype's tread clipping |

### Controls

| Action | Keyboard + mouse | Xbox controller |
|---|---|---|
| Throttle / reverse | W / S | Left stick Y |
| Turn hull | A / D | Left stick X |
| Aim turret | Mouse (ground point) | Right stick |
| Fire cannon (primary) | LMB / Space | RT |
| Fire machine gun (secondary) | RMB / F (hold) | LT (hold) |
| Pause | Esc | Start |

## 4. Weapons and damage

| | Cannon (primary) | Machine gun (secondary) |
|---|---|---|
| Role | Heavy, deliberate, breaks cover | Fast, chip damage, finishing |
| Base damage | 50 | 3 per round |
| Limiter | `ReloadLimiter` — 1.35 s | `HeatLimiter` — ~33 rounds to overheat, re-arms at 32% heat |
| Projectile speed | 68 u/s | 105 u/s |
| vs. crates | Destroys in 1 hit | No effect |
| vs. pillars/walls | Impact only | Impact only |

**Damage formula:** `damage = base × armorMultiplier(hit angle relative to target hull)`.
Front = within ±45° of hull forward; rear = within ±45° of hull back; otherwise side.

**Between-wave repair:** +20% of max armor (+20), capped at max.

## 5. Enemy: insurgent tank
Weaker than the player by design, so numbers carry the threat.

| Property | Starting value |
|---|---|
| Armor (health) | 60 |
| Directional armor | front ×0.65, side ×1.0, rear ×1.25 |
| Drive speed / turn | 4.0 u/s / 1.4 rad/s; reverse 60%; 0.5 s to top speed, 0.15 s to stop, 0.2 s gear change; same footprint as the player |
| Mass / track grip | 20 / 30 u/s² (lighter than the player, so it can be shoved) |
| Turret traverse | 1.8 rad/s |
| Weapon | Cannon: 12 base damage, 2.4 s reload, slight aim spread |
| Visual | Same primitive tank, insurgent colors, distinct silhouette detail |

Kills to expect with the cannon: front = 2 hits (32.5 each), side = 2 hits (50 each), **rear = 1 hit** (62.5). The one-shot rear kill is the deliberate payoff for flanking. Machine gun alone needs ~20 side hits, about 60% of a heat bar.

### AI behavior

| State | Behavior | Exits to |
|---|---|---|
| **Advance** | Path (grid A*, replans every 0.5 s) toward a firing spot 8–12 u from the player with line of sight | Engage on reaching it with line of sight |
| **Engage** | Stop; **turn hull to keep front armor toward the player**; track with turret; fire when aligned and line of sight is clear | Reposition if line of sight is lost > 1.5 s, or the player gets behind it |
| **Reposition** | Pick a new firing spot (prefer behind cover relative to the player) | Advance |

- Telegraph: brief muzzle glow ~0.3 s before each enemy shot (readability pillar).
- **Friendly fire is on:** shells damage any vehicle they hit, including other enemies, which rewards baiting enemies into each other's line of fire. To keep the AI from looking foolish, enemies **hold fire when an ally is in their line of fire** (a ray check before each shot), so friendly hits mostly happen when allies move into the path after a shot is fired.
- Enemies avoid driving through each other; spawn gates stagger arrivals.

## 6. Arena
- About **46 × 46 units** (prototype was 38 × 38), enclosed by walls.
- **3 spawn gates** (left, right, top). Player starts bottom-center.
- **Indestructible pillars/wall segments (6–8):** create lanes and angles that persist all run.
- **Breakable crates (12–16):** cannon destroys them; they **stay destroyed for the rest of the run**, so the arena opens up as waves progress. Pillars keep minimum cover. If wave 5 feels coverless in playtests, raise the crate count before revisiting rebuild.
- Layout is defined in `defs/arenas.ts` (typed data). Blender-authored arenas come later.

## 7. Camera, HUD and readability
- **Camera:** high angle between top-down and isometric, smoothed follow (from prototype).
- **HUD:** armor bar, cannon reload bar, MG heat bar, `WAVE n / 5`, enemies remaining, breather countdown.
- **Off-screen indicators:** edge-of-screen arrows for enemies outside the view (the arena is larger than one screen).
- **Spawn warnings:** gate glow plus an edge arrow if the gate is off-screen.
- **Damage feedback:** hit flash on any damaged vehicle; the player's armor bar pulses when critical (≤30%).

## 8. Feel ("juice") in scope
- Screen shake: cannon fire (small), player hit (medium), nearby kill (medium).
- Hit-stop: ~60 ms on kills.
- Muzzle-flash light, recoil kick on the cannon.
- Explosion and smoke via Babylon particle presets; crate break-apart into a few chunks.
- Tread marks and MG heat glow (from prototype).
- Vehicle clash: sparks and a shake scaled by impact strength when vehicles collide (`VehiclesCollided` event, M2 plan D1).
- Hull pitches back when accelerating, dips forward when braking, and rocks on a gear change (the look of inertia). Pulled forward into M2-6 with the primitive tank view.
- Placeholder sound effects: cannon, machine gun, impact, explosion, wave start/clear.

## 9. Run summary
Victory or defeat banner · waves cleared · time · kills · shots fired / hit / accuracy (per weapon) · damage taken. Buttons: **Restart** (default) and **Title**.

## 10. Out of scope for the slice
Credits/pickups, garage/upgrades, ammo limits, multiple chassis, walker legs, additional enemy types, MG pushing crates (physics cover), room-clearing mode, co-op, settings menu, key rebinding, save data, Blender assets, music.

## 11. Acceptance criteria
- [ ] A full run (win or lose) plays start to finish with no page refresh.
- [ ] Hits from the front visibly deal less damage than flank/rear hits (feedback is noticeable in play).
- [ ] Enemies path around cover and never get permanently stuck.
- [ ] Enemy shells can destroy other enemies; enemies don't fire when an ally blocks the shot.
- [ ] Keyboard/mouse and Xbox controller both play the full run.
- [ ] Collision: no shots register in empty space; treads never visibly enter obstacles.
- [ ] Holds 60 fps with wave 5 on screen on an M1 MacBook Air.
- [ ] Simulation unit tests pass in CI (damage, limiters, waves, pathfinding, determinism).
- [ ] **Fun test:** the developer wants to start another run after finishing one.

## 12. Resolved decisions (2026-11-18)
1. **Repair:** +20% of max armor between waves.
2. **Friendly fire:** on, with AI holding fire when an ally blocks the shot.
3. **Crates:** stay destroyed between waves (revisit after playtesting).

_All numbers are starting values for tuning. They live in `src/sim/defs/` and are expected to change during playtesting._
