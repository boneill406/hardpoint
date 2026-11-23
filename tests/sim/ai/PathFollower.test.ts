import { describe, expect, it } from 'vitest';
import { PathFollower, type FollowStep } from '../../../src/sim/ai/PathFollower';
import { degToRad } from '../../../src/sim/core/angles';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { INSURGENT_AI } from '../../../src/sim/defs/ai';

const DRIVING = INSURGENT_AI.driving;
const TICK = 1 / 60;
const pose = (x: number, z: number, heading = 0): Transform => ({
  position: new Vec2(x, z),
  heading,
});

function following(path: Vec2[], from = Vec2.ZERO): PathFollower {
  const follower = new PathFollower(DRIVING, TICK);
  follower.setPath(path, from, false);
  return follower;
}

/** Feeds the same pose for `ticks` ticks (a tank that isn't moving) and returns every step. */
function holdStill(follower: PathFollower, at: Transform, ticks: number): FollowStep[] {
  return Array.from({ length: ticks }, () => follower.update(at));
}

describe('PathFollower steering', () => {
  it('lined up with a straight path: full throttle, no turn', () => {
    const step = following([new Vec2(0, 20)]).update(pose(0, 0));
    expect(step).toMatchObject({ throttle: 1, turn: 0, status: 'driving' });
    expect(step.toward).toEqual(new Vec2(0, DRIVING.lookAhead));
  });

  it('a goal behind it: stops and turns in place, the short way round', () => {
    const right = following([new Vec2(3, -10)]).update(pose(0, 0));
    expect(right.throttle).toBe(0);
    expect(right.turn).toBe(1); // the goal is clockwise (toward +x) of the tail
    const left = following([new Vec2(-3, -10)]).update(pose(0, 0));
    expect(left.turn).toBe(-1);
  });

  it('a small heading error gives a proportional turn and a little less throttle', () => {
    const goal = Vec2.fromHeading(degToRad(10)).scale(20);
    const step = following([goal]).update(pose(0, 0));
    expect(step.turn).toBeCloseTo(10 / 25, 6);
    expect(step.throttle).toBeCloseTo(1 - 10 / 60, 6);
  });

  it('slows over the last 2 u and stops inside the arrive radius', () => {
    const follower = following([new Vec2(0, 10)]);
    expect(follower.update(pose(0, 9)).throttle).toBeCloseTo(0.5, 6);
    expect(follower.update(pose(0, 9.4)).throttle).toBeCloseTo(0.3, 6);
    expect(follower.update(pose(0, 9.6))).toEqual({ throttle: 0, turn: 0, status: 'arrived' });
  });

  it('never drops below the minimum throttle while still driving (just under the pivot angle)', () => {
    const goal = Vec2.fromHeading(degToRad(59)).scale(20);
    expect(following([goal]).update(pose(0, 0)).throttle).toBe(DRIVING.minThrottle);
  });

  it('aims a look-ahead along the path, so it starts turning before reaching a corner', () => {
    // Path: up 5 u, then right. 1 u before the corner the look-ahead point is already on the second leg.
    const follower = following([new Vec2(0, 5), new Vec2(10, 5)]);
    expect(follower.update(pose(0, 4)).turn).toBeGreaterThan(0);
  });

  it('with no path it idles', () => {
    expect(new PathFollower(DRIVING, TICK).update(pose(0, 0)).status).toBe('idle');
  });
});

describe('PathFollower stuck recovery', () => {
  const windowTicks = DRIVING.stuck.window * 60;
  const reverseTicks = DRIVING.stuck.reverseTime * 60;

  it('not moving for a whole window: reverses for the back-off time, then asks for a new plan', () => {
    const follower = following([new Vec2(0, 20)]);
    const steps = holdStill(follower, pose(0, 0), windowTicks + reverseTicks + 1);
    const statuses = steps.map((step) => step.status);
    expect(statuses.slice(0, windowTicks)).toEqual(Array(windowTicks).fill('driving'));
    const backing = steps.slice(windowTicks, windowTicks + reverseTicks - 1);
    expect(backing.every((step) => step.status === 'unsticking' && step.throttle === -1)).toBe(
      true,
    );
    expect(statuses[windowTicks + reverseTicks - 1]).toBe('replan');
  });

  it('pivoting on the spot counts as progress, not stuck', () => {
    const follower = following([new Vec2(0, -20)]); // behind: it pivots
    const steps = Array.from({ length: windowTicks * 3 }, (_, i) =>
      follower.update(pose(0, 0, degToRad(i * 0.5))),
    );
    expect(steps.every((step) => step.status === 'driving')).toBe(true);
  });

  it('gives up on a goal after the third failed back-off; alternates the back-off turn', () => {
    const follower = following([new Vec2(0, 20)]);
    const at = pose(0, 0);
    const turns: number[] = [];
    for (let attempt = 1; attempt <= DRIVING.stuck.maxAttempts; attempt++) {
      const steps = holdStill(follower, at, windowTicks + reverseTicks);
      turns.push(steps.find((step) => step.status === 'unsticking')?.turn ?? 0);
      expect(steps.at(-1)?.status).toBe('replan');
      follower.setPath([new Vec2(0, 20)], at.position, true);
    }
    expect(turns).toEqual([1, -1, 1]);
    const last = holdStill(follower, at, windowTicks + 1);
    expect(last.at(-1)?.status).toBe('gave-up');
  });

  it('a path to a different goal resets the count', () => {
    const follower = following([new Vec2(0, 20)]);
    for (let attempt = 1; attempt <= DRIVING.stuck.maxAttempts; attempt++) {
      holdStill(follower, pose(0, 0), windowTicks + reverseTicks);
      follower.setPath([new Vec2(0, 20)], Vec2.ZERO, true);
    }
    follower.setPath([new Vec2(5, 20)], Vec2.ZERO, false);
    const steps = holdStill(follower, pose(0, 0), windowTicks + 1);
    expect(steps.at(-1)?.status).toBe('unsticking');
  });
});
