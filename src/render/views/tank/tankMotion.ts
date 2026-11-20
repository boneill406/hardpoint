// Pure maths for how a tank *looks* when it moves: tread scroll and hull pitch.
// Render-only (no sim effect), but unit-tested because the prototype got the
// tread signs wrong and these are easy to get backwards.

/** Each track's surface speed (u/s, positive = forward), from the sim's motion. */
export interface TreadSpeeds {
  readonly left: number;
  readonly right: number;
}

/**
 * How fast each track runs. Turning right (positive angular velocity, clockwise)
 * swings the left track round the outside, so it runs faster:
 *   left = forward + ω·d,  right = forward − ω·d   (d = half the track spacing).
 * Pivoting in place (forward 0) gives equal and opposite speeds.
 */
export function treadSpeeds(
  forwardSpeed: number,
  angularVelocity: number,
  halfTrackSpacing: number,
): TreadSpeeds {
  const swing = angularVelocity * halfTrackSpacing;
  return { left: forwardSpeed + swing, right: forwardSpeed - swing };
}

/**
 * 0..1: how much to blur a tread pattern so it can't strobe. A repeating
 * pattern that moves more than half its period per frame looks like it races,
 * freezes or runs backwards (the wagon-wheel effect that made the prototype's
 * treads look far too fast). Blur ramps in from a quarter period per frame and
 * is complete by 0.45, before the eye can be fooled.
 */
export function treadBlur(speed: number, frameSeconds: number, patternPeriod: number): number {
  const periodsPerFrame = (Math.abs(speed) * frameSeconds) / patternPeriod;
  return Math.min(1, Math.max(0, (periodsPerFrame - 0.25) / 0.2));
}

/** Hull pitch per unit of forward acceleration (rad per u/s²): full throttle ≈ 3°. */
const PITCH_PER_ACCELERATION = 0.003;
/** Never pitch more than this (rad, ≈ 5°): it's a heavy tank, not a car. */
const MAX_PITCH = 0.09;

/**
 * Where the hull wants to pitch for a given forward acceleration, as Babylon
 * `rotation.x` (positive = nose down). Speeding up tips the nose up; braking,
 * or accelerating backwards, dips it.
 */
export function pitchTarget(forwardAcceleration: number): number {
  const pitch = -forwardAcceleration * PITCH_PER_ACCELERATION;
  return Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch));
}

export interface SpringState {
  readonly angle: number;
  readonly velocity: number;
}

/** Suspension feel: ~3 Hz, under-damped so the hull rocks once on a gear change. */
const SPRING_FREQUENCY_HZ = 3;
const DAMPING_RATIO = 0.35;
/** Integrate in steps no longer than this, so a slow frame can't make the spring explode. */
const MAX_SPRING_STEP = 1 / 120;

/** Advances the pitch spring toward `target` by `frameSeconds` (semi-implicit Euler). */
export function stepPitchSpring(
  state: SpringState,
  target: number,
  frameSeconds: number,
): SpringState {
  const omega = 2 * Math.PI * SPRING_FREQUENCY_HZ;
  const stiffness = omega * omega;
  const damping = 2 * DAMPING_RATIO * omega;
  let { angle, velocity } = state;
  let remaining = Math.max(0, frameSeconds);
  while (remaining > 0) {
    const dt = Math.min(MAX_SPRING_STEP, remaining);
    velocity += (stiffness * (target - angle) - damping * velocity) * dt;
    angle += velocity * dt;
    remaining -= dt;
  }
  return { angle, velocity };
}
