import type { Vec2 } from '../core/Vec2';
import type { Vehicle } from '../vehicles/Vehicle';
import type { ArmorFace, FaceRule } from './ArmorDef';
import type { WeaponDef } from './WeaponDef';

/** One hit that dealt damage: what `Simulation` reports as `Hit`. */
export interface DamageResult {
  readonly face: ArmorFace;
  /** Health actually removed (capped by what was left). */
  readonly damage: number;
  readonly healthLeft: number;
  readonly destroyed: boolean;
}

/** A shot meeting a vehicle's hull (barrel hits never get here: plan D17). */
export interface VehicleHit {
  readonly target: Vehicle;
  readonly weapon: WeaponDef;
  readonly shotHeading: number;
  readonly normal: Vec2;
}

/**
 * Turns a hull hit into damage (architecture.md §5 step 5, GDD §5):
 * `damage = base × armor multiplier(face)`, applied to the target's `Health`.
 * `faceRule` overrides every def's rule (`?armor=`, plan D5); undefined uses each def's own.
 */
export class DamageResolver {
  constructor(private readonly faceRule?: FaceRule) {}

  /** Applies the hit; undefined if the target was already destroyed earlier this tick. */
  resolve(hit: VehicleHit): DamageResult | undefined {
    const { target } = hit;
    if (target.health.depleted) {
      return undefined;
    }
    const face = target.armor.faceOf(
      {
        hullHeading: target.transform.heading,
        shotHeading: hit.shotHeading,
        normal: hit.normal,
      },
      this.faceRule,
    );
    const damage = target.health.damage(hit.weapon.damage * target.armor.multiplier(face));
    return {
      face,
      damage,
      healthLeft: target.health.current,
      destroyed: target.health.depleted,
    };
  }
}
