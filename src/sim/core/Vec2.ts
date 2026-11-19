/**
 * A point or direction on the ground plane (x, z), in units.
 *
 * Immutable: every operation returns a new `Vec2`. Entities can hand out their
 * position without callers being able to move them by accident, and a stored
 * `previousTransform` can't change when the current one does.
 *
 * Heading convention (architecture.md §9): heading 0 faces +z, positive headings
 * turn toward +x (clockwise seen from above), and forward = `(sin h, cos h)`.
 */
export class Vec2 {
  static readonly ZERO = new Vec2(0, 0);

  constructor(
    readonly x: number,
    readonly z: number,
  ) {}

  /** Unit vector pointing along `heading` (radians). Heading 0 → +z, π/2 → +x. */
  static fromHeading(heading: number): Vec2 {
    return new Vec2(Math.sin(heading), Math.cos(heading));
  }

  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.z + other.z);
  }

  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.z - other.z);
  }

  scale(factor: number): Vec2 {
    return new Vec2(this.x * factor, this.z * factor);
  }

  dot(other: Vec2): number {
    return this.x * other.x + this.z * other.z;
  }

  /** Cheaper than `length()` when only comparing distances. */
  lengthSquared(): number {
    return this.dot(this);
  }

  length(): number {
    return Math.hypot(this.x, this.z);
  }

  distanceTo(other: Vec2): number {
    return other.sub(this).length();
  }

  /**
   * Unit vector in the same direction. A zero vector stays zero instead of
   * becoming NaN, so "no input" or "already at the target" can't poison state.
   */
  normalize(): Vec2 {
    const length = this.length();
    if (length === 0) {
      return Vec2.ZERO;
    }
    return this.scale(1 / length);
  }

  /** Heading (radians, in (-π, π]) this vector points along. The inverse of `fromHeading`. */
  heading(): number {
    return Math.atan2(this.x, this.z);
  }

  /** Rotates by `angle` radians using the heading convention: positive turns +z toward +x. */
  rotate(angle: number): Vec2 {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    return new Vec2(this.x * cos + this.z * sin, this.z * cos - this.x * sin);
  }

  /** Straight-line blend: `t` = 0 gives this vector, 1 gives `other`. Used for render interpolation. */
  lerp(other: Vec2, t: number): Vec2 {
    return new Vec2(this.x + (other.x - this.x) * t, this.z + (other.z - this.z) * t);
  }
}
