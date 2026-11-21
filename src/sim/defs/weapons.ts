import { degToRad } from '../core/angles';
import type { WeaponDef } from '../combat/WeaponDef';

// Weapon tuning (GDD §4, §5; M3 plan starting values). Designer terms: rounds
// per second, rounds to overheat. Every timing is a whole number of 60 Hz
// ticks (M3 plan D13; tested).

/** Heavy and deliberate: breaks cover; one shot per reload. */
export const CANNON: WeaponDef = {
  name: 'Cannon',
  damage: 50,
  // 90 u/s: faster than the prototype's 68 (Brendan: felt slow), still slower than the MG.
  projectile: { speed: 90, radius: 0.07, lifetime: 2, look: 'shell' },
  spread: 0,
  breaksCover: true,
  limiters: [{ kind: 'reload', seconds: 1.5 }],
};

/** Fast chip damage: 12 rounds/s (raised from 10 in play), overheats after 30 (2.5 s), re-arms at 30% heat. */
export const MACHINE_GUN: WeaponDef = {
  name: 'Machine gun',
  damage: 3,
  projectile: { speed: 100, radius: 0.04, lifetime: 2, look: 'tracer' },
  spread: degToRad(1),
  breaksCover: false,
  limiters: [
    { kind: 'reload', seconds: 5 / 60 }, // 12 rounds/s: exactly 5 ticks between rounds
    { kind: 'heat', roundsToOverheat: 30, coolPerSecond: 0.25, rearmAt: 0.3 },
  ],
};

/** The insurgent tank's gun: weaker and less accurate than the player's (GDD §5). */
export const INSURGENT_CANNON: WeaponDef = {
  name: 'Insurgent cannon',
  damage: 12,
  projectile: { speed: 70, radius: 0.07, lifetime: 2, look: 'shell' },
  spread: degToRad(3),
  breaksCover: true,
  limiters: [{ kind: 'reload', seconds: 2.4 }],
};
