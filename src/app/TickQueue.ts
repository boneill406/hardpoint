/**
 * Things to do at a later sim tick (M6-2c: the cannon's case comes out during
 * the reload). Keyed by tick, not wall time, so pausing or hit-stop delays
 * them just as it delays the game. Pure, unit-tested.
 */
export class TickQueue<T> {
  private items: { readonly due: number; readonly item: T }[] = [];

  add(due: number, item: T): void {
    this.items.push({ due, item });
  }

  /** Removes and returns everything due at or before `tick`, in the order added. */
  takeDue(tick: number): T[] {
    const due = this.items.filter((entry) => entry.due <= tick).map((entry) => entry.item);
    this.items = this.items.filter((entry) => entry.due > tick);
    return due;
  }

  get size(): number {
    return this.items.length;
  }
}
