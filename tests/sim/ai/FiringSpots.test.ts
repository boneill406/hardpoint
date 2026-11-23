import { describe, expect, it } from 'vitest';
import { chooseFiringSpot } from '../../../src/sim/ai/FiringSpots';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { INSURGENT_AI } from '../../../src/sim/defs/ai';
import { FakeWorld, fakeVehicle } from './fakeWorld';

const ENGAGE = INSURGENT_AI.engage;

describe('chooseFiringSpot', () => {
  it('only offers open spots with sight of the target', () => {
    const pillar = { center: new Vec2(0, 12), width: 3, depth: 3 };
    const world = new FakeWorld([pillar]);
    const target = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
    const me = world.add(fakeVehicle(2, 'insurgent', new Vec2(0, 16)));
    // The pillar sits on the 12 u ring straight above; sight is blocked for spots above x ±2.
    world.sight = (from) => !(Math.abs(from.x) < 2 && from.z > 0);
    const spot = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: false });
    expect(spot).toBeDefined();
    if (spot === undefined) return;
    expect(world.navGrid.isOpenAt(spot)).toBe(true);
    expect(Math.abs(spot.x) >= 2 || spot.z <= 0).toBe(true);
  });

  it('spreads out: a spot next to an ally costs extra', () => {
    const world = new FakeWorld();
    const target = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
    const me = world.add(fakeVehicle(2, 'insurgent', new Vec2(0, 15)));
    const alone = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: false });
    world.add(fakeVehicle(3, 'insurgent', alone ?? Vec2.ZERO));
    const spread = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: false });
    expect(alone).toBeDefined();
    expect(spread?.distanceTo(alone ?? Vec2.ZERO)).toBeGreaterThanOrEqual(ENGAGE.allySpacing);
  });

  it('when repositioning, trades a little distance for a spot beside cover', () => {
    // From (0, 10) it is already on the 10 u ring: advancing stays put. Repositioning must move
    // 3 u; its nearest choices are (±2.07, 7.73) at 3.1 u, in the open. A crate down-left puts
    // cover beside (−4, 6.93), 5.0 u away, which wins once the cover bonus counts.
    const crate = { center: new Vec2(-7, 4), width: 1.5, depth: 1.5 };
    const world = new FakeWorld([crate]);
    const target = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
    const me = world.add(fakeVehicle(2, 'insurgent', new Vec2(0, 10)));
    const advancing = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: false });
    const repositioning = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: true });
    expect(advancing?.x).toBeCloseTo(0, 6);
    expect(advancing?.z).toBeCloseTo(10, 6);
    expect(repositioning?.x).toBeCloseTo(-4, 2);
    expect(repositioning?.z).toBeCloseTo(6.93, 2);
  });

  it('when repositioning, never picks a spot within 3 u of where it is', () => {
    const world = new FakeWorld();
    const target = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
    const me = world.add(fakeVehicle(2, 'insurgent', new Vec2(0, 8)));
    const spot = chooseFiringSpot(world, me, target, ENGAGE, { repositioning: true });
    expect(spot?.distanceTo(me.transform.position)).toBeGreaterThanOrEqual(ENGAGE.minMove);
  });

  it('returns undefined when no spot can see the target', () => {
    const world = new FakeWorld();
    const target = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
    const me = world.add(fakeVehicle(2, 'insurgent', new Vec2(0, 15)));
    world.sight = () => false;
    expect(chooseFiringSpot(world, me, target, ENGAGE, { repositioning: false })).toBeUndefined();
  });
});
