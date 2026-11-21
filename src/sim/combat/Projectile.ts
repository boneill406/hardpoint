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
  /** The tick after a hit: it has been drawn at the impact point and can go. */
  | { readonly kind: 'spent' }
  | { readonly kind: 'expired' };

export interface ProjectileSnapshot extends EntitySnapshot {
  readonly vx: number;
  readonly vz: number;
  readonly age: number;
  readonly impacted: number;
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
  private impacted = false;

  constructor(
    /** Where it left the muzzle; the view's motion streak never reaches back past it. */
    readonly origin: Vec2,
    heading: number,
    readonly weapon: WeaponDef,
    /** Who fired it: its own body is ignored by the sweep. */
    readonly owner: EntityId,
  ) {
    super({ position: origin, heading });
  }

  /** u/s while flying; zero once it has hit something. */
  get velocity(): Vec2 {
    if (this.impacted) {
      return Vec2.ZERO;
    }
    return Vec2.fromHeading(this.transform.heading).scale(this.weapon.projectile.speed);
  }

  /** True from the tick it hit something until it is removed. */
  get hasImpacted(): boolean {
    return this.impacted;
  }

  /**
   * Advances one tick. On a hit it stops at the impact point and stays there
   * for one more tick before it is `spent`: the renderer draws between the last
   * two ticks, so removing it in the tick it hit would make it vanish short of
   * the surface (up to two ticks of travel, ~2 u for a shell).
   */
  step(dt: number, cast: SweepCast): ProjectileStep {
    if (this.impacted) {
      return { kind: 'spent' };
    }
    const { position, heading } = this.transform;
    const target = position.add(this.velocity.scale(dt));
    const hit = cast(position, target, this.weapon.projectile.radius);
    if (hit !== undefined) {
      this.setTransform({ position: position.lerp(target, hit.fraction), heading });
      this.impacted = true;
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
    return {
      ...super.snapshot(),
      vx: velocity.x,
      vz: velocity.z,
      age: this.age,
      impacted: this.impacted ? 1 : 0,
    };
  }
}
