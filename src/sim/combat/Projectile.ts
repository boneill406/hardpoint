import type { EntityId, EntitySnapshot } from '../core/Entity';
import { Entity } from '../core/Entity';
import { Vec2 } from '../core/Vec2';
import type { CastHit } from '../physics/PhysicsWorld';
import type { WeaponDef } from './WeaponDef';

/** Sweeps the projectile's circle along a path segment; supplied by the Simulation. */
export type SweepCast = (from: Vec2, to: Vec2, radius: number) => CastHit | undefined;

/** What happened to a projectile this tick. */
export type ProjectileStep =
  | { readonly kind: 'flying' }
  | { readonly kind: 'hit'; readonly hit: CastHit }
  | { readonly kind: 'expired' };

export interface ProjectileSnapshot extends EntitySnapshot {
  readonly vx: number;
  readonly vz: number;
  readonly age: number;
}

const TIME_EPSILON = 1e-9;

/**
 * A shell or bullet in flight (architecture.md §3). Moved by the sim, not by
 * physics: each tick it sweeps its circle from where it was to where it will
 * be, so it can't tunnel through thin walls and only hits real shapes (M3
 * plan D4). One class for every weapon and faction; the def says how it flies.
 */
export class Projectile extends Entity {
  private age = 0;

  constructor(
    origin: Vec2,
    heading: number,
    readonly weapon: WeaponDef,
    /** Who fired it: its own body is ignored by the sweep. */
    readonly owner: EntityId,
  ) {
    super({ position: origin, heading });
  }

  /** u/s, constant for the shot's whole flight. */
  get velocity(): Vec2 {
    return Vec2.fromHeading(this.transform.heading).scale(this.weapon.projectile.speed);
  }

  /** Advances one tick. On a hit it stops at the impact point, so the shot is drawn where it struck. */
  step(dt: number, cast: SweepCast): ProjectileStep {
    const { position, heading } = this.transform;
    const target = position.add(this.velocity.scale(dt));
    const hit = cast(position, target, this.weapon.projectile.radius);
    if (hit !== undefined) {
      this.setTransform({ position: position.lerp(target, hit.fraction), heading });
      return { kind: 'hit', hit };
    }
    this.setTransform({ position: target, heading });
    this.age += dt;
    if (this.age + TIME_EPSILON >= this.weapon.projectile.lifetime) {
      return { kind: 'expired' };
    }
    return { kind: 'flying' };
  }

  override snapshot(): ProjectileSnapshot {
    const velocity = this.velocity;
    return { ...super.snapshot(), vx: velocity.x, vz: velocity.z, age: this.age };
  }
}
