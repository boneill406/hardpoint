# ADR-0004: Object-oriented composition instead of an ECS library

- **Status:** Accepted
- **Date:** 2026-11-18

## Context
The prototype stored crates, pillars and the enemy tank in one array distinguished by flags (`isEnemy`). Player and enemy had separate projectile code. A structured entity model is needed.

Options considered: an Entity-Component-System library (miniplex, bitECS) or object-oriented design. The developer prefers OOP. Expected entity counts are dozens, not thousands.

## Decision
Use **object-oriented design with composition**:

- **Shallow inheritance only:** `Entity` → `Vehicle` | `Projectile` | `Prop`. No deeper hierarchies.
- **Variation through composed parts behind interfaces:** `Locomotion`, `Controller`, `FireLimiter`, `PhysicsWorld`.
- **Content through data:** typed definitions (`VehicleDef`, `WeaponDef`, `ArmorDef`) assembled by factories. A new tank or weapon variant is new data, not a new class, unless it needs new behavior.
- **Player and enemies share classes.** They differ only by definition, faction and `Controller`.
- **Weapons hold a list of `FireLimiter`s** (fire allowed only if all permit). The slice uses one limiter per weapon.
- A `World` registry owns entities and provides lookup by id and type.

## Alternatives considered
- **miniplex (ECS).** Clean queries and good TypeScript support, but data-oriented style conflicts with the OOP preference. Single-maintainer project with slowing activity.
- **bitECS.** Very fast, but its typed-array data layout is hard to read and debug. Performance isn't a constraint at this scale.

## Consequences
- ➕ Readable, conventional code that matches the developer's mental model.
- ➕ No ECS dependency.
- ➖ Cross-cutting queries ("everything with armor") need explicit registry methods or interfaces.

## Revisit when
Hundreds of active entities with highly varied capability mixes make type-based lookup awkward or slow.
