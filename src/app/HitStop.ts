/**
 * Hit-stop (M6-1b, plan D7): a ~60 ms freeze when the player destroys a tank,
 * so the kill lands with weight. The app simply doesn't tick while frozen (as
 * with pause); rendering carries on. Pure and unit-tested.
 */
export class HitStop {
  private left = 0;

  constructor(private readonly enabled: boolean) {}

  get frozen(): boolean {
    return this.left > 0;
  }

  /** Freeze for `seconds` (a longer freeze already running is kept). */
  trigger(seconds: number): void {
    if (this.enabled) {
      this.left = Math.max(this.left, seconds);
    }
  }

  /** Once per frame with real elapsed seconds. */
  update(frameSeconds: number): void {
    this.left = Math.max(0, this.left - Math.max(0, frameSeconds));
  }
}
