/**
 * A vehicle's hit points (GDD calls them "armor"). Kept separate from
 * `ArmorProfile` so repairs between waves (M5) and the HUD only touch this.
 */
export class Health {
  private value: number;

  constructor(readonly max: number) {
    if (!(max > 0)) {
      throw new RangeError(`Health needs a positive max, got ${max}`);
    }
    this.value = max;
  }

  get current(): number {
    return this.value;
  }

  /** True at 0: the vehicle is destroyed. */
  get depleted(): boolean {
    return this.value <= 0;
  }

  /**
   * Adds `amount` back (never above max) and returns how much was actually
   * gained: the between-wave repair (GDD §4). A destroyed vehicle can't be
   * repaired; it is already out of the world.
   */
  repair(amount: number): number {
    if (this.depleted) {
      return 0;
    }
    const gained = Math.min(this.max - this.value, Math.max(0, amount));
    this.value += gained;
    return gained;
  }

  /** Removes `amount` (never below 0) and returns how much was actually lost. */
  damage(amount: number): number {
    const lost = Math.min(this.value, Math.max(0, amount));
    this.value -= lost;
    return lost;
  }
}
