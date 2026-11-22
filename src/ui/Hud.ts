import type { Vehicle } from '../sim/vehicles/Vehicle';
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
.hud-armor.critical .hud-fill { background: #e0533d; }
.hud-armor.critical { animation: hud-pulse 0.7s ease-in-out infinite alternate; }
.hud-reload .hud-fill { background: #c9b27a; }
.hud-reload.ready .hud-fill { background: #e8d9a0; }
.hud-heat .hud-fill { background: linear-gradient(90deg, #d6a64a, #e0533d); }
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
    this.armor.value.textContent = `${Math.ceil(armor.current)} / ${armor.max}`;
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
    const row = this.addRow(gauge.name, gauge.kind === 'heat' ? 'hud-heat' : 'hud-reload');
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
    row.fill.style.width = percent(gauge.heat);
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

function percent(fraction: number): string {
  return `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(1)}%`;
}
