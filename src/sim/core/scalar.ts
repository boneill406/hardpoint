// Small number helpers shared by simulation systems.

/** Limits `value` to [min, max]. Commands from input (or later, the network) are clamped, never trusted. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Moves `current` toward `target` by at most `maxDelta` without overshooting.
 * The building block of rate-limited change: acceleration, braking, turn ramps.
 */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  return Math.max(current - maxDelta, target);
}
