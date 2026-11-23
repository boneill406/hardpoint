import { angleDelta } from '../core/angles';
import { clamp } from '../core/scalar';
import type { Transform } from '../core/Transform';
import type { Vec2 } from '../core/Vec2';
import type { DrivingDef } from './AiDef';

/** What the follower wants this tick, and why. */
export interface FollowStep {
  readonly throttle: number;
  readonly turn: number;
  /**
   * - `driving`: on its way.
   * - `arrived`: at the end of the path; stopped.
   * - `unsticking`: backing off after getting stuck.
   * - `replan`: finished backing off; the caller should plan a fresh path.
   * - `gave-up`: stuck too often on the way to this goal; pick another.
   * - `idle`: no path.
   */
  readonly status: 'driving' | 'arrived' | 'unsticking' | 'replan' | 'gave-up' | 'idle';
  /**
   * While driving: the look-ahead point it is steering for. Aiming the turret
   * here keeps the barrel pointing along the path; a barrel left pointing
   * sideways (the turret is stabilised) snags on cover the hull clears.
   */
  readonly toward?: Vec2;
}

/**
 * Turns a path into throttle and turn (M4 plan D4), and notices when the tank
 * isn't getting anywhere (D7). It drives through the vehicle's normal
 * locomotion, so an AI tank has the same inertia and gear changes as the
 * player's.
 *
 * Steering is "pure pursuit": aim at a point `lookAhead` along the path, turn
 * in proportion to the heading error, and stop to pivot when the error is
 * large. Stateful only for the path and the stuck check.
 */
export class PathFollower {
  private path: readonly Vec2[] = [];
  /** Where the current leg starts: the tank's position when the path was set, then each passed waypoint. */
  private legStart: Vec2 | undefined;
  private next = 0;
  private attempts = 0;
  private reversing = 0;
  private windowTicks = 0;
  private windowStart: Transform | undefined;

  constructor(
    private readonly def: DrivingDef,
    private readonly tickSeconds: number,
  ) {}

  /**
   * Follows `path` from `from`. A new path to the same goal keeps the stuck
   * count (so repeated failures add up); a different goal resets it.
   */
  setPath(path: readonly Vec2[], from: Vec2, sameGoal: boolean): void {
    this.path = path;
    this.legStart = from;
    this.next = 0;
    this.windowTicks = 0;
    this.windowStart = undefined;
    if (!sameGoal) {
      this.attempts = 0;
    }
  }

  /** The waypoints still ahead (for the debug view). */
  get remaining(): readonly Vec2[] {
    return this.path.slice(this.next);
  }

  update(pose: Transform): FollowStep {
    if (this.reversing > 0) {
      return this.backOff();
    }
    const goal = this.path.at(-1);
    if (goal === undefined || this.legStart === undefined) {
      return { throttle: 0, turn: 0, status: 'idle' };
    }
    if (pose.position.distanceTo(goal) <= this.def.arriveRadius) {
      return { throttle: 0, turn: 0, status: 'arrived' };
    }
    if (this.isStuck(pose)) {
      this.attempts++;
      if (this.attempts > this.def.stuck.maxAttempts) {
        this.path = [];
        return { throttle: 0, turn: 0, status: 'gave-up' };
      }
      this.reversing = Math.round(this.def.stuck.reverseTime / this.tickSeconds);
      return this.backOff();
    }
    this.passWaypoints(pose.position);
    return this.steer(pose, goal);
  }

  private steer(pose: Transform, goal: Vec2): FollowStep {
    const target = this.lookAheadPoint(pose.position);
    const error = angleDelta(pose.heading, target.sub(pose.position).heading());
    const turn = clamp(error / this.def.fullTurnAngle, -1, 1);
    if (Math.abs(error) > this.def.turnInPlaceAngle) {
      return { throttle: 0, turn, status: 'driving', toward: target };
    }
    // Ease off as the error grows, and near the end of the path.
    const aligned = 1 - Math.abs(error) / this.def.turnInPlaceAngle;
    const approach = pose.position.distanceTo(goal) / this.def.slowRadius;
    const throttle = clamp(Math.min(aligned, approach), this.def.minThrottle, 1);
    return { throttle, turn, status: 'driving', toward: target };
  }

  /** Reverse, turning one way on odd attempts and the other on even, so repeated tries differ. */
  private backOff(): FollowStep {
    this.reversing--;
    if (this.reversing > 0) {
      const turn = this.attempts % 2 === 1 ? 1 : -1;
      return { throttle: -1, turn, status: 'unsticking' };
    }
    this.windowTicks = 0;
    this.windowStart = undefined;
    return { throttle: 0, turn: 0, status: 'replan' };
  }

  /**
   * Stuck = a whole window of trying to drive in which the tank neither moved
   * `minDistance` nor turned `minTurn`. Pivoting on the spot counts as progress.
   */
  private isStuck(pose: Transform): boolean {
    if (this.windowStart === undefined) {
      this.windowStart = pose;
      this.windowTicks = 0;
      return false;
    }
    this.windowTicks++;
    if (this.windowTicks < Math.round(this.def.stuck.window / this.tickSeconds)) {
      return false;
    }
    const moved = pose.position.distanceTo(this.windowStart.position);
    const turned = Math.abs(angleDelta(this.windowStart.heading, pose.heading));
    this.windowStart = pose;
    this.windowTicks = 0;
    return moved < this.def.stuck.minDistance && turned < this.def.stuck.minTurn;
  }

  /** Moves on to the next waypoint once the tank is within look-ahead of the current one (never past the last). */
  private passWaypoints(position: Vec2): void {
    while (this.next < this.path.length - 1) {
      const waypoint = this.path[this.next];
      if (waypoint === undefined || position.distanceTo(waypoint) > this.def.lookAhead) {
        return;
      }
      this.legStart = waypoint;
      this.next++;
    }
  }

  /**
   * The point `lookAhead` further along the path than the tank's closest
   * point on its current leg (walking onto later legs as needed), or the goal.
   */
  private lookAheadPoint(position: Vec2): Vec2 {
    let from = this.legStart ?? position;
    let remaining = this.def.lookAhead;
    for (let i = this.next; i < this.path.length; i++) {
      const to = this.path[i];
      if (to === undefined) {
        break;
      }
      const leg = to.sub(from);
      const legLength = leg.length();
      // Where along this leg the tank is now (only for the first leg).
      const along =
        i === this.next && legLength > 0
          ? clamp(position.sub(from).dot(leg) / legLength, 0, legLength)
          : 0;
      if (along + remaining <= legLength) {
        return from.add(leg.scale((along + remaining) / legLength));
      }
      remaining -= legLength - along;
      from = to;
    }
    return this.path.at(-1) ?? position;
  }
}
