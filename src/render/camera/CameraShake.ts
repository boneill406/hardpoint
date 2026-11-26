/** Shake tuning (M6 plan D6). Trauma is 0..1; the shake is trauma², so small knocks stay subtle. */
export interface ShakeDef {
  /** Trauma lost per second. */
  readonly decayPerSecond: number;
  /** Camera offset (u) at full trauma. */
  readonly maxOffset: number;
  /** How fast the shake wobbles (Hz-ish). */
  readonly frequency: number;
}

/** A sideways and up/down offset to add to the camera, in u. */
export interface ShakeOffset {
  readonly x: number;
  readonly y: number;
}

/**
 * Screen shake by "trauma" (M6-1b): hits add trauma, it decays steadily, and
 * the camera is nudged by `maxOffset × trauma²` along a smooth wobble. Squaring
 * keeps a small knock barely visible and a big one violent. Render-only and
 * pure (time passed in), so it's unit-tested; the wobble is a sum of sines,
 * not randomness, so it's smooth and repeatable.
 */
export class CameraShake {
  private trauma = 0;
  private time = 0;

  constructor(private readonly def: ShakeDef) {}

  get level(): number {
    return this.trauma;
  }

  /** Adds trauma, capped at 1. */
  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  /** Advances by `frameSeconds` and returns this frame's camera offset. */
  update(frameSeconds: number): ShakeOffset {
    this.time += frameSeconds;
    this.trauma = Math.max(0, this.trauma - this.def.decayPerSecond * frameSeconds);
    const amount = this.def.maxOffset * this.trauma * this.trauma;
    if (amount === 0) {
      return { x: 0, y: 0 };
    }
    const t = this.time * this.def.frequency;
    return {
      x: amount * wobble(t, 1.0, 2.3),
      y: amount * wobble(t, 1.7, 3.1),
    };
  }

  reset(): void {
    this.trauma = 0;
  }
}

/** A smooth pseudo-random wave in about −1..1 from two sines at unrelated rates. */
function wobble(t: number, a: number, b: number): number {
  return 0.6 * Math.sin(t * a * 6.283) + 0.4 * Math.sin(t * b * 6.283 + 1.3);
}
