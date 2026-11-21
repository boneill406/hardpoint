import type { Vec2 } from '../core/Vec2';
import type { HardpointDef } from '../vehicles/VehicleDef';
import { Weapon } from './Weapon';
import type { WeaponDef } from './WeaponDef';

/** A shot a vehicle fired this tick: where it leaves the muzzle and which way it goes. */
export interface Shot {
  readonly mount: WeaponMount;
  /** Muzzle position on the ground plane. */
  readonly origin: Vec2;
  /** Travel heading, spread included. */
  readonly heading: number;
}

/**
 * A weapon fitted to a hardpoint (architecture.md §3, M3 plan D14). The
 * hardpoint says where and which trigger; the weapon brings its barrel and
 * muzzles. Together they give the muzzle position: the single source of truth
 * for where shells start, what the barrel collides with, and how long it is
 * drawn.
 */
export class WeaponMount {
  readonly weapon: Weapon;
  private clear = 1;
  private previousClear = 1;
  private muzzleIndex = 0;

  constructor(
    readonly hardpoint: HardpointDef,
    weaponDef: WeaponDef,
  ) {
    this.weapon = new Weapon(weaponDef);
  }

  /**
   * The muzzle the next shot leaves from, in the hardpoint's frame (forward
   * along the turret or hull, right across it). Twin guns alternate muzzles.
   */
  get muzzleOffset(): { readonly forward: number; readonly right: number } {
    const { at } = this.hardpoint;
    const { barrel, muzzles } = this.weapon.def;
    const muzzle = muzzles[this.muzzleIndex % muzzles.length];
    return { forward: at.forward + barrel.length, right: at.right + (muzzle?.right ?? 0) };
  }

  /** After a shot: the next one leaves from the next muzzle (twin guns). */
  advanceMuzzle(): void {
    this.muzzleIndex = (this.muzzleIndex + 1) % this.weapon.def.muzzles.length;
  }

  /**
   * 0..1: how much of the line from the frame's origin to the muzzle is
   * unobstructed this tick (1 = clear). Shots start at the clear point (M3-7).
   */
  get clearance(): number {
    return this.clear;
  }

  /** Clearance at the end of the previous tick, for render interpolation. */
  get previousClearance(): number {
    return this.previousClear;
  }

  setClearance(fraction: number): void {
    this.clear = Math.min(1, Math.max(0, fraction));
  }

  /** Called with the vehicle's `saveTransform` at the start of each tick. */
  saveClearance(): void {
    this.previousClear = this.clear;
  }

  snapshot(): Readonly<Record<string, number>>[] {
    return [...this.weapon.snapshot(), { clearance: this.clear, muzzle: this.muzzleIndex }];
  }
}
