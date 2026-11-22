import type { WeaponMount } from '../sim/combat/WeaponMount';
import type { WeaponSlot } from '../sim/vehicles/VehicleDef';
import type { Vehicle } from '../sim/vehicles/Vehicle';

/** GDD §7: the armor bar pulses at or below this fraction. */
export const CRITICAL_ARMOR = 0.3;

/** Everything the HUD draws, as plain numbers: worked out here so it can be unit-tested without a DOM. */
export interface HudState {
  readonly armor: {
    readonly current: number;
    readonly max: number;
    /** 0..1 */
    readonly fraction: number;
    readonly critical: boolean;
  };
  readonly weapons: readonly WeaponGauge[];
}

/**
 * One bar per weapon. A reload-only weapon (cannon) shows reload progress; a
 * weapon with heat (MG) shows heat, since its cadence is too short to read.
 */
export type WeaponGauge = ReloadGauge | HeatGauge;

export interface ReloadGauge {
  readonly kind: 'reload';
  readonly name: string;
  readonly slot: WeaponSlot;
  /** 0 just fired … 1 ready. */
  readonly progress: number;
  readonly ready: boolean;
}

export interface HeatGauge {
  readonly kind: 'heat';
  readonly name: string;
  readonly slot: WeaponSlot;
  /** 0 cold … 1 full. */
  readonly heat: number;
  readonly overheated: boolean;
  /** Heat at which an overheated weapon fires again: the bar's marker. */
  readonly rearmAt: number;
}

/** The HUD's view of the player's tank this frame (read-only, M3 plan D10). */
export function hudState(vehicle: Vehicle): HudState {
  const { current, max } = vehicle.health;
  const fraction = current / max;
  return {
    armor: { current, max, fraction, critical: fraction <= CRITICAL_ARMOR },
    weapons: vehicle.mounts.map(gaugeFor),
  };
}

function gaugeFor(mount: WeaponMount): WeaponGauge {
  const { weapon, hardpoint } = mount;
  const statuses = weapon.describe();
  const name = weapon.def.name;
  const slot = hardpoint.trigger;
  for (const status of statuses) {
    if (status.kind === 'heat') {
      const def = weapon.def.limiters.find((limiter) => limiter.kind === 'heat');
      return {
        kind: 'heat',
        name,
        slot,
        heat: status.heat,
        overheated: status.overheated,
        rearmAt: def?.kind === 'heat' ? def.rearmAt : 0,
      };
    }
  }
  const progress = Math.min(
    1,
    ...statuses.map((status) => (status.kind === 'reload' ? status.progress : 1)),
  );
  return { kind: 'reload', name, slot, progress, ready: weapon.canFire() };
}
