import { describe, expect, it } from 'vitest';
import { formatAccuracy, formatRunTime, RunStats } from '../../src/app/RunStats';
import type { SimEvents } from '../../src/sim/core/SimEvents';
import { Vec2 } from '../../src/sim/core/Vec2';

const PLAYER = 1;
const ENEMY = 7;

function shot(shooter: number, weapon: string): SimEvents['ShotFired'] {
  return { shooter, slot: 'primary', hardpoint: 'main', weapon, origin: Vec2.ZERO, heading: 0 };
}

function hit(
  attacker: number,
  target: number,
  weapon: string,
  damage: number,
  destroyed = false,
): SimEvents['Hit'] {
  return {
    attacker,
    target,
    weapon,
    face: 'front',
    damage,
    healthLeft: 0,
    destroyed,
    point: Vec2.ZERO,
  };
}

describe('RunStats', () => {
  it("counts the player's shots and hits per weapon, in the order first fired", () => {
    const stats = new RunStats(PLAYER);
    stats.onShotFired(shot(PLAYER, 'Machine gun'));
    stats.onShotFired(shot(PLAYER, 'Cannon'));
    stats.onShotFired(shot(PLAYER, 'Cannon'));
    stats.onShotFired(shot(ENEMY, 'Insurgent cannon'));
    stats.onHit(hit(PLAYER, ENEMY, 'Cannon', 32.5));
    expect(stats.summary().weapons).toEqual([
      { weapon: 'Machine gun', fired: 1, hit: 0 },
      { weapon: 'Cannon', fired: 2, hit: 1 },
    ]);
  });

  it("lists the player's loadout even if a weapon was never fired", () => {
    const stats = new RunStats(PLAYER, ['Cannon', 'Machine gun']);
    stats.onShotFired(shot(PLAYER, 'Machine gun'));
    expect(stats.summary().weapons).toEqual([
      { weapon: 'Cannon', fired: 0, hit: 0 },
      { weapon: 'Machine gun', fired: 1, hit: 0 },
    ]);
  });

  it('a kill is a player hit that destroyed the enemy; friendly-fire kills are not yours', () => {
    const stats = new RunStats(PLAYER);
    stats.onHit(hit(PLAYER, ENEMY, 'Cannon', 32.5));
    stats.onHit(hit(PLAYER, ENEMY, 'Cannon', 27.5, true));
    stats.onHit(hit(ENEMY + 1, ENEMY + 2, 'Insurgent cannon', 60, true));
    expect(stats.summary().kills).toBe(1);
  });

  it('damage taken sums every hit on the player, whoever fired', () => {
    const stats = new RunStats(PLAYER);
    stats.onHit(hit(ENEMY, PLAYER, 'Insurgent cannon', 7.8));
    stats.onHit(hit(ENEMY, PLAYER, 'Insurgent cannon', 12));
    expect(stats.summary().damageTaken).toBeCloseTo(19.8, 9);
  });

  it('counts waves cleared and the run length in ticks', () => {
    const stats = new RunStats(PLAYER);
    stats.onWaveCleared();
    stats.onWaveCleared();
    stats.setTicks(60 * 125);
    expect(stats.summary()).toMatchObject({ wavesCleared: 2, seconds: 125 });
  });
});

describe('summary formatting', () => {
  it('shows time as m:ss', () => {
    expect(formatRunTime(125.9)).toBe('2:05');
    expect(formatRunTime(9)).toBe('0:09');
  });

  it('shows accuracy as hits / shots and a rounded percentage', () => {
    expect(formatAccuracy({ weapon: 'Cannon', fired: 20, hit: 12 })).toBe('12 / 20 hits (60%)');
    expect(formatAccuracy({ weapon: 'Cannon', fired: 3, hit: 1 })).toBe('1 / 3 hits (33%)');
    expect(formatAccuracy({ weapon: 'Cannon', fired: 0, hit: 0 })).toBe('no shots');
  });
});
