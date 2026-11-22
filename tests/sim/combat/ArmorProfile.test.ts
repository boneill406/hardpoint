import { describe, expect, it } from 'vitest';
import { ArmorProfile, type ArmorHit } from '../../../src/sim/combat/ArmorProfile';
import { degToRad } from '../../../src/sim/core/angles';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { TANK_ARMOR } from '../../../src/sim/defs/armor';

const armor = new ArmorProfile(TANK_ARMOR);

/** A shot arriving from `fromDeg` off the hull's forward (0 = dead ahead, 90 = from the right). */
function from(fromDeg: number, hullHeading = 0): ArmorHit {
  const toward = hullHeading + degToRad(fromDeg);
  return {
    hullHeading,
    shotHeading: toward + Math.PI,
    normal: Vec2.fromHeading(toward),
  };
}

describe('ArmorProfile, rule "direction"', () => {
  it('a cannon hit 10° off the front deals front-armor damage', () => {
    expect(armor.faceOf(from(10), 'direction')).toBe('front');
    expect(armor.multiplier('front')).toBe(0.65);
  });

  it('the front arc is ±45°: 44° is front, 46° is side, on either side', () => {
    expect(armor.faceOf(from(44), 'direction')).toBe('front');
    expect(armor.faceOf(from(-44), 'direction')).toBe('front');
    expect(armor.faceOf(from(46), 'direction')).toBe('side');
    expect(armor.faceOf(from(-46), 'direction')).toBe('side');
  });

  it('the rear arc is ±45° around the back: 134° is side, 136° is rear', () => {
    expect(armor.faceOf(from(134), 'direction')).toBe('side');
    expect(armor.faceOf(from(136), 'direction')).toBe('rear');
    expect(armor.faceOf(from(-136), 'direction')).toBe('rear');
    expect(armor.faceOf(from(180), 'direction')).toBe('rear');
  });

  it('faces turn with the hull: a shot travelling +z hits a hull facing −z in the front, one facing +z in the rear', () => {
    const goingPlusZ: ArmorHit = { hullHeading: Math.PI, shotHeading: 0, normal: new Vec2(0, -1) };
    expect(armor.faceOf(goingPlusZ, 'direction')).toBe('front');
    expect(armor.faceOf({ ...goingPlusZ, hullHeading: 0 }, 'direction')).toBe('rear');
  });

  it('multipliers follow the GDD: front 0.65, side 1.0, rear 1.25', () => {
    expect([armor.multiplier('front'), armor.multiplier('side'), armor.multiplier('rear')]).toEqual(
      [0.65, 1.0, 1.25],
    );
  });
});

describe('ArmorProfile, rule "struck"', () => {
  it('uses the surface normal, not where the shot came from', () => {
    // Fired from dead astern (direction: rear), but it struck the right side face.
    const hit: ArmorHit = { hullHeading: 0, shotHeading: 0, normal: new Vec2(1, 0) };
    expect(armor.faceOf(hit, 'direction')).toBe('rear');
    expect(armor.faceOf(hit, 'struck')).toBe('side');
  });

  it('a corner normal goes to the face it is more square to', () => {
    const nearFront = Vec2.fromHeading(degToRad(40));
    const nearSide = Vec2.fromHeading(degToRad(50));
    expect(armor.faceOf({ hullHeading: 0, shotHeading: 0, normal: nearFront }, 'struck')).toBe(
      'front',
    );
    expect(armor.faceOf({ hullHeading: 0, shotHeading: 0, normal: nearSide }, 'struck')).toBe(
      'side',
    );
  });

  it('the def picks the rule when none is given', () => {
    const struck = new ArmorProfile({ ...TANK_ARMOR, faceRule: 'struck' });
    const hit: ArmorHit = { hullHeading: 0, shotHeading: 0, normal: new Vec2(1, 0) };
    expect(struck.faceOf(hit)).toBe('side');
    expect(armor.faceOf(hit)).toBe('rear');
  });
});
