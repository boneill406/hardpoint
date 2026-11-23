import type { Vehicle } from '../sim/vehicles/Vehicle';
import { amountLabel } from './amountLabel';
import { hudState, type WeaponGauge } from './hudState';

/** Styles live with the component: the HUD is the only HTML in the game so far. */
const CSS = `
.hud { position: fixed; left: 16px; bottom: 16px; width: 240px; padding: 10px 12px;
  background: rgba(14, 16, 15, 0.72); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 4px;
  font: 11px/1.2 ui-monospace, Menlo, monospace; color: #e6e6dc; letter-spacing: 0.06em;
  pointer-events: none; user-select: none; }
.hud-row + .hud-row { margin-top: 8px; }
.hud-head { display: flex; justify-content: space-between; margin-bottom: 3px; text-transform: uppercase; }
.hud-value { opacity: 0.8; }
.hud-bar { position: relative; height: 8px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.hud-fill { height: 100%; width: 0; }
.hud-marker { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.55); }
.hud-armor .hud-fill { background: #7fbf5f; }
/* Critical pulses the fill's colour, not the row's opacity: an opacity animation puts the row on
   its own compositing layer, and Safari then leaves stale paint when the fill shrinks (M3-6 fix). */
.hud-armor.critical .hud-fill { background: #e0533d; animation: hud-critical 0.7s ease-in-out infinite alternate; }
@keyframes hud-critical { from { background-color: #e0533d; } to { background-color: #7a2a20; } }
.hud-reload .hud-fill { background: #c9b27a; }
.hud-reload.ready .hud-fill { background: #e8d9a0; }
.hud-heat .hud-fill { width: 100%;
  background: linear-gradient(90deg, #c2cc4b 0%, #e3d04a 40%, #e8913a 70%, #e0533d 100%); }
.hud-heat.overheated .hud-value { color: #ff6a50; animation: hud-pulse 0.35s ease-in-out infinite alternate; }
@keyframes hud-pulse { from { opacity: 1; } to { opacity: 0.45; } }
`;

interface Row {
  readonly root: HTMLDivElement;
  readonly value: HTMLSpanElement;
  readonly fill: HTMLDivElement;
  readonly marker: HTMLDivElement;
}

/**
 * The player's HUD (M3-6, M3 plan D10, GDD §7): armor, cannon reload and MG
 * heat bars. HTML over the canvas; reads the player's vehicle once per frame
 * and never writes simulation state. Wave counter, enemies left and the
 * countdown join it in M5.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly armor: Row;
  private readonly weapons: Row[] = [];

  constructor(parent: HTMLElement) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.armor = this.addRow('Armor', 'hud-armor');
    parent.append(this.root);
  }

  /** Once per frame. The player's tank object stays readable after it is destroyed (health 0). */
  update(player: Vehicle): void {
    const state = hudState(player);
    const { armor } = state;
    this.armor.fill.style.width = percent(armor.fraction);
    this.armor.value.textContent = `${amountLabel(armor.current)} / ${armor.max}`;
    this.armor.root.classList.toggle('critical', armor.critical);

    state.weapons.forEach((gauge, index) => {
      const row = this.weapons[index] ?? this.addWeaponRow(gauge);
      this.showGauge(row, gauge);
    });
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }

  private addWeaponRow(gauge: WeaponGauge): Row {
    const label = gauge.kind === 'heat' ? `${gauge.name} heat` : gauge.name;
    const row = this.addRow(label, gauge.kind === 'heat' ? 'hud-heat' : 'hud-reload');
    this.weapons.push(row);
    return row;
  }

  private showGauge(row: Row, gauge: WeaponGauge): void {
    if (gauge.kind === 'reload') {
      row.fill.style.width = percent(gauge.progress);
      row.value.textContent = gauge.ready ? 'Ready' : 'Reloading';
      row.root.classList.toggle('ready', gauge.ready);
      return;
    }
    // The gradient spans the whole bar (green cold → red full); heat reveals it from the left.
    row.fill.style.clipPath = `inset(0 ${(100 - clamp01(gauge.heat) * 100).toFixed(1)}% 0 0)`;
    row.marker.style.display = 'block';
    row.marker.style.left = percent(gauge.rearmAt);
    row.value.textContent = gauge.overheated ? 'Overheated' : `${Math.round(gauge.heat * 100)}%`;
    row.root.classList.toggle('overheated', gauge.overheated);
  }

  private addRow(label: string, kind: string): Row {
    const root = document.createElement('div');
    root.className = `hud-row ${kind}`;
    const head = document.createElement('div');
    head.className = 'hud-head';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'hud-value';
    head.append(name, value);
    const bar = document.createElement('div');
    bar.className = 'hud-bar';
    const fill = document.createElement('div');
    fill.className = 'hud-fill';
    const marker = document.createElement('div');
    marker.className = 'hud-marker';
    marker.style.display = 'none';
    bar.append(fill, marker);
    root.append(head, bar);
    this.root.append(root);
    return { root, value, fill, marker };
  }
}

function clamp01(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function percent(fraction: number): string {
  return `${(clamp01(fraction) * 100).toFixed(1)}%`;
}
