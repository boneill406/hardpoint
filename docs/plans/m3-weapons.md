# M3 Plan — Turret, weapons, damage

_Approved by Brendan 2026-11-20. Milestone definition: [`milestones.md`](../milestones.md) § M3. Status: **done** 2026-11-21 (done-when checked in play by Brendan)._

**Goal:** shoot things, and directional armor works.
**Done when:** front hits on the dummy visibly deal less than rear hits; the machine gun overheats and re-arms; tests cover armor angles and multi-limiter weapons. Plus M3-7: the barrel never visibly enters obstacles.

## Decisions (approved)
| # | Question | Decision |
|---|---|---|
| D1 | Turret | **Stabilised** (prototype): holds its world heading while the hull turns; traverses toward the aim point at the def's rate (player 4.0 rad/s, insurgent 1.8). Waits a 0.05 s spin-up before moving; snaps when within 1°; ignores aim points within 1.2 u of the tank. `Turret` composed into `Vehicle`; values in `TurretDef` |
| D2 | Weapons are data | `WeaponDef` in `defs/weapons.ts` (damage, projectile speed and radius, spread cone, `breaksCover`, limiters) in designer units; per-shot values derived. **MG = `ReloadLimiter` (cadence) + `HeatLimiter`**, the architecture's two-limiter case. Cannon = `ReloadLimiter`. Insurgent cannon defined now, fired by the AI in M4. Spread uses the sim `Rng` |
| D3 | Firing | **Hold to fire**: each weapon fires whenever its limiters allow. Taps shorter than a frame are latched so they still fire once (T-56) |
| D4 | Projectiles | `Projectile` entity moved by the sim (not a physics body). Each tick a **swept circle cast** from its last position to its new one (`PhysicsWorld.castCircle`, real oriented boxes): no tunneling, no hits in empty space. Ignores its shooter; expires after 2 s. Friendly fire on (GDD §5) |
| D5 | Armor face | **Both rules built, chosen per `ArmorDef.faceRule`**: `direction` (default: where the shot came from relative to the hull, GDD's ±45° arcs) and `struck` (the face the shell hit, from the cast's normal; corners go to the face it's more square to). `?armor=struck` switches all tanks for comparison at the M3-5 check; Brendan then keeps one (or both). **Picked: `struck` is the default; `?armor=direction` stays as a toggle** |
| D6 | Damage | `ArmorProfile` (from `ArmorDef`, `defs/armor.ts`), `Health`, `DamageResolver`: damage = base × multiplier. At 0 health the vehicle is removed (`EntityDestroyed`). Events: `ShotFired`, `Hit { target, attacker, damage, face, point }`, `ProjectileImpact` |
| D7 | Crates | Cannon (`breaksCover`) removes a crate in one hit, through the normal remove path; the MG doesn't affect crates |
| D8 | Dummies | Debug scene: three stationary insurgent dummies facing front / side / rear toward the player start; the circling insurgent stays. No respawn (reload the page) |
| D9 | Debug overlay | `?hp=on`: health bar over each damaged vehicle plus the last hit ("−32.5 front"). HTML overlay, debug-only (enemy health bars aren't in the GDD) |
| D10 | HUD | HTML overlay (`src/ui/Hud`): armor, cannon reload, MG heat (with overheated state). Reads the player's state each frame. No new dependency |
| D11 | Muzzle clearance (M3-7) | Per mount, each tick: cast from the turret pivot to the muzzle. Blocked → the shot starts at the obstacle and hits it that tick. `TankView` retracts the barrel to the same clear distance; barrel length comes from the mount def, so the visible tip is the sim's muzzle |
| D12 | Snapshot | `VehicleSnapshot` adds turret heading, health, limiter state; projectiles snapshot position and velocity |
| D14 | Hardpoints (added 2026-11-20) | `VehicleDef.hardpoints` (id, on turret or hull, position, size class, trigger, cosmetic height) + `loadout` (hardpoint id → weapon). The weapon owns its barrel (`BarrelDef`: length, collision radius, look, `collides`) and muzzle offsets (twin guns alternate). Muzzles are derived (hardpoint + barrel length), so swapping weapons moves muzzles, collision and drawn barrels together. Size classes validated when a vehicle is built. Replaces the M3-2 mount list |
| D15 | Barrel collision (added) | Each colliding barrel is an extra collider on the vehicle's body, re-posed every tick from the turret heading (massless, so handling is unchanged). Nosing in stops at the barrel |
| D16 | Turret blocked (added) | Before the turret turns, the sim measures how deep a barrel would overlap anything (including other barrels) at the new angle; a turn may not deepen it, so the turret **stalls** (no shoving the hull) |
| D17 | Shots and barrels (added) | Shots **stop at barrels but deal no damage** to them: `ProjectileImpact` gains `part: 'hull' \| 'barrel'`, and the damage resolver (M3-4) skips barrel hits. Muzzle clearance treats other tanks' barrels as obstacles. Both cannon and coax barrels collide. **Amended in M4-5 (Brendan): barrel hits now deal damage, at the armor's `barrel` multiplier (×0.65, the front value).** |
| D13 | Round numbers on whole ticks | Timings must be whole numbers of 60 Hz ticks (0.095 s = 5.7 ticks would give an uneven 5/6-tick MG cadence). Starting values below; a def test enforces whole ticks |

## Starting values (GDD §3–§5 updated)
| Value | Prototype | Slice |
|---|---|---|
| MG fire rate | 0.095 s (≈10.5/s) | **10 rounds/s** (6 ticks); raised to **12/s** (5 ticks) in play |
| MG rounds to overheat | ≈33 | **30** (3 s of fire; no cooling while firing) |
| MG cooling when idle | 0.24/s | **0.25/s** (4 s full → empty) |
| MG re-arm | 32% | **30%** (2.8 s lockout after overheating) |
| MG spread | ±0.5° | **1° cone** |
| Cannon reload | 1.35 s | **1.5 s** (to try; 1.35 is the fallback) |
| Turret traverse | 4.1 rad/s | **4.0 rad/s** |
| Turret spin-up | 0.07 s | **0.05 s** (3 ticks) |
| Turret snap angle | 0.02 rad | **1°** |
| Shell speed (cannon / MG) | 68 / 105 u/s | **70 / 100 u/s** (cannon raised to 90 in play) |
| Shell radius (cannon / MG) | 0.068 / 0.035 | **0.07 / 0.04** |
| Insurgent cannon spread | "slight" | **3° cone** |

## Tasks (build order)
| Order | Task | Branch | Status |
|---|---|---|---|
| 1 | M3-1 `Turret`, `TurretDef`; aim from `VehicleCommand.aimPoint`; `TankView` rotates the turret | `m3-1-turret` | ✅ |
| 2 | M3-2 `Weapon`, `FireLimiter`, `ReloadLimiter`, `HeatLimiter`, `WeaponMount`, `defs/weapons.ts`; input tap latching | `m3-2-weapons` | ✅ |
| 3 | M3-3 `Projectile`, `PhysicsWorld.castCircle`, `ProjectileView` (shell, MG tracer), `ProjectileImpact` | `m3-3-projectiles` | ✅ |
| 4 | M3-7 Muzzle clearance (barrel retraction removed after playtest: barrels stay rigid, T-75) | `m3-7-muzzle` | ✅ |
| 4a | M3-8a Hardpoints and barrels as data (D14): refactor, derived muzzles, size validation, twin muzzles | `m3-8a-hardpoints` | ✅ |
| 4b | M3-8b Barrel collision (D15–D17): attached colliders, turret stall, impacts report the part hit | `m3-8b-barrel-collision`, `m3-8b-barrel-fixes` | ✅ |
| 5 | M3-4 `ArmorProfile` (both face rules, `?armor=`), `Health`, `DamageResolver`, `Hit`; vehicles destroyed at 0 | `m3-4-damage` | ✅ |
| 6 | M3-5 Crates break; three dummies; `?hp=on` overlay. **Done-when check; armor rule pick** | `m3-5-targets` | ✅ (armor pick: `struck`) |
| 7 | M3-6 HUD | `m3-6-hud` | ✅ |

## Tests (highlights)
| Area | Behaviours |
|---|---|
| Turret | Traverse rate; spin-up delay; snap within 1°; holds world heading while the hull turns; ignores aim within 1.2 u; short way round |
| Limiters | `ReloadLimiter` blocks for its time; `HeatLimiter` blocks at full heat and re-arms at 30%; no cooling while firing; **two limiters fire only when both allow**; MG: exactly 30 rounds at 10/s then locked out 2.8 s |
| Projectiles | No tunneling through a thin wall at 100 u/s; **a shot through the gap past a 45°-rotated tank's corner misses** (prototype bug); ignores the shooter; expires; spread is deterministic |
| Armor | **10° off the front deals front damage**; 44° front, 46° side (`direction`); `struck` picks the face from the normal; rear ×1.25; GDD kill counts (insurgent: 2 front, 2 side, 1 rear cannon hits) |
| Crates, muzzle | Cannon removes a crate and its collider; MG doesn't; a blocked muzzle hits the obstacle the same tick |
| Defs | Every timing is a whole number of ticks |
| Determinism | Combat (spread, hits, destruction) identical from the same seed and commands |

## Trade-offs to record
Hold-to-fire · armor by shot direction by default (both rules until the pick) · projectiles as swept casts, planar (no arcing over crates) · debug-only health overlay · no dummy respawn · no MG cooling while firing.

## Out of scope
Enemy AI firing (M4) · muzzle flash, recoil, explosions, shake (M6) · player death ending the run (M5; until then a destroyed player tank is just removed).
