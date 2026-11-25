/**
 * Which menu item is highlighted (M5-4, plan D8): moved with arrows, D-pad or
 * stick, set by mouse hover. Wraps at both ends. Pure, so it's unit-tested.
 */
export class MenuNavigator {
  private selected = 0;

  constructor(private count: number) {}

  get index(): number {
    return this.selected;
  }

  /** A new list of items: highlight the first (the default action). */
  reset(count: number): void {
    this.count = count;
    this.selected = 0;
  }

  /** +1 = down, −1 = up, wrapping around. */
  move(delta: number): void {
    if (this.count <= 0) {
      return;
    }
    this.selected = (((this.selected + delta) % this.count) + this.count) % this.count;
  }

  /** Mouse hover. Out-of-range indices are ignored. */
  set(index: number): void {
    if (index >= 0 && index < this.count) {
      this.selected = index;
    }
  }
}
