/** How the hazard sign looks at one moment of a windup. */
export interface TelegraphSignFrame {
  /** How much of the triangle has filled with bright yellow, bottom to top (0..1): full = the shot. */
  readonly fill: number;
  /** Size relative to normal: pops in slightly oversized, then settles. */
  readonly scale: number;
  /** In the last stretch before the shot: the sign blinks brighter. */
  readonly urgent: boolean;
  /** Past its time with no shot or cancel event (e.g. the event was missed): remove it. */
  readonly expired: boolean;
}

/** Pop-in time (s) and the overshoot it settles from. */
const POP = { seconds: 0.08, from: 0.55, overshoot: 1.15 };
/** The last part of the windup (fraction) shown as urgent. */
const URGENT_FROM = 0.7;
/** Grace (s) after the windup before an unended sign is dropped. */
const GRACE = 0.1;

/**
 * The sign's animation as plain numbers, so it is unit-tested without a DOM
 * (`tests/ui/`). `age` is seconds since `ShotTelegraphed`; `seconds` is the
 * windup length from that event.
 */
export function telegraphSignFrame(age: number, seconds: number): TelegraphSignFrame {
  const t = seconds > 0 ? Math.min(1, Math.max(0, age / seconds)) : 1;
  return {
    fill: t,
    scale: popScale(age),
    urgent: t >= URGENT_FROM,
    expired: age > seconds + GRACE,
  };
}

/** Grows from `from` to `overshoot` over the first half of the pop, then settles to 1. */
function popScale(age: number): number {
  const p = Math.min(1, Math.max(0, age / POP.seconds));
  if (p < 0.5) {
    return POP.from + (POP.overshoot - POP.from) * (p / 0.5);
  }
  return POP.overshoot + (1 - POP.overshoot) * ((p - 0.5) / 0.5);
}
