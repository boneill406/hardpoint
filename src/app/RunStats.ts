import type { EntityId } from '../sim/core/Entity';
import type { SimEvents } from '../sim/core/SimEvents';
import { TICK_RATE } from '../sim/core/time';

/** One weapon's shots and hits, in the order the player first fired it. */
export interface WeaponStats {
  readonly weapon: string;
  readonly fired: number;
  readonly hit: number;
}

/** A finished (or running) run's numbers, for the summary screen (GDD §9). */
export interface RunStatsSummary {
  readonly wavesCleared: number;
  readonly seconds: number;
  readonly kills: number;
  readonly weapons: readonly WeaponStats[];
  readonly damageTaken: number;
}

/**
 * Counts a run's stats from simulation events only (M5-5, plan D11): no new
 * sim state, and nothing here can change the game. A **hit** is a player shot
 * that damaged an enemy tank (barrel included); crates and walls don't count.
 * A **kill** is a player hit that destroyed it. The player is the only tank on
 * its side, so any vehicle the player hits is an enemy.
 */
export class RunStats {
  private wavesCleared = 0;
  private kills = 0;
  private damageTaken = 0;
  private ticks = 0;
  private readonly weapons = new Map<string, { fired: number; hit: number }>();

  /** `weapons`: the player's loadout, so a weapon never fired still shows ("no shots"). */
  constructor(
    private readonly playerId: EntityId,
    weapons: readonly string[] = [],
  ) {
    for (const weapon of weapons) {
      this.weaponEntry(weapon);
    }
  }

  onShotFired({ shooter, weapon }: SimEvents['ShotFired']): void {
    if (shooter === this.playerId) {
      this.weaponEntry(weapon).fired++;
    }
  }

  onHit({ attacker, target, weapon, damage, destroyed }: SimEvents['Hit']): void {
    if (target === this.playerId) {
      this.damageTaken += damage;
      return;
    }
    if (attacker !== this.playerId) {
      return;
    }
    this.weaponEntry(weapon).hit++;
    if (destroyed) {
      this.kills++;
    }
  }

  onWaveCleared(): void {
    this.wavesCleared++;
  }

  /** The run's length in sim ticks (pauses and menus don't tick, so don't count). */
  setTicks(ticks: number): void {
    this.ticks = ticks;
  }

  summary(): RunStatsSummary {
    return {
      wavesCleared: this.wavesCleared,
      seconds: this.ticks / TICK_RATE,
      kills: this.kills,
      weapons: [...this.weapons].map(([weapon, counts]) => ({ weapon, ...counts })),
      damageTaken: this.damageTaken,
    };
  }

  private weaponEntry(weapon: string): { fired: number; hit: number } {
    const existing = this.weapons.get(weapon);
    if (existing !== undefined) {
      return existing;
    }
    const entry = { fired: 0, hit: 0 };
    this.weapons.set(weapon, entry);
    return entry;
  }
}

/** "2:05" (minutes and whole seconds, rounded down). */
export function formatRunTime(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "12 / 20 hits (60%)"; "no shots" when the weapon wasn't fired. */
export function formatAccuracy({ fired, hit }: WeaponStats): string {
  if (fired === 0) {
    return 'no shots';
  }
  return `${hit} / ${fired} hits (${Math.round((hit / fired) * 100)}%)`;
}
