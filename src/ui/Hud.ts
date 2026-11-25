import type { WaveStatus } from '../sim/modes/WaveSurvivalMode';
import type { Vehicle } from '../sim/vehicles/Vehicle';
import { amountLabel } from './amountLabel';
import { hudState, type WeaponGauge } from './hudState';
import { waveHudState } from './waveHud';

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
.hud-run { display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12); text-transform: uppercase; }
.hud-run[hidden] { display: none; }
.hud-wave { color: #f2e6b8; }
.hud-countdown { color: #9fd98a; }
/* Repair flash (M5-6a): a green glow on the bar and the amount gained, both fading out.
   Box-shadow and colour, not opacity on the row (see the Safari note above). */
.hud-armor.repaired .hud-bar { animation: hud-repair 0.9s ease-out; }
@keyframes hud-repair { from { box-shadow: 0 0 0 2px #9fef7a, 0 0 10px #9fef7a; } to { box-shadow: none; } }
.hud-gain { margin-right: 8px; color: #9fef7a; }
.hud-armor.repaired .hud-gain { animation: hud-gain 1.6s ease-out forwards; }
@keyframes hud-gain { 0%, 60% { color: #9fef7a; } 100% { color: transparent; } }
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
 * and never writes simulation state. Since M5-6a a line on top shows the
 * wave, enemies left and the breather countdown, and the armor bar flashes
 * green on a repair.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly armor: Row;
  private readonly weapons: Row[] = [];
  private readonly run: { root: HTMLDivElement; wave: HTMLSpanElement; right: HTMLSpanElement };
  private readonly gain: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.run = this.addRunLine();
    this.armor = this.addRow('Armor', 'hud-armor');
    this.gain = document.createElement('span');
    this.gain.className = 'hud-gain';
    // Keep the armor number right-aligned: the gain sits just before it, in one right-hand group.
    const right = document.createElement('span');
    this.armor.value.replaceWith(right);
    right.append(this.gain, this.armor.value);
    parent.append(this.root);
  }

  /**
   * Once per frame. The player's tank object stays readable after it is
   * destroyed (health 0). `run` is the wave mode's status; omitted in the
   * sandbox, which hides the wave line.
   */
  update(player: Vehicle, run?: WaveStatus): void {
    this.showRun(run);
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

  /** The breather repaired the player (`BreatherStarted`): flash the armor bar and show what was gained. */
  flashRepair(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.gain.textContent = `+${amountLabel(amount)}`;
    // Restart the animation even if the last flash is still running.
    this.armor.root.classList.remove('repaired');
    void this.armor.root.offsetWidth;
    this.armor.root.classList.add('repaired');
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }

  private showRun(run: WaveStatus | undefined): void {
    this.run.root.hidden = run === undefined;
    if (run === undefined) {
      return;
    }
    const state = waveHudState(run);
    this.run.wave.textContent = state.wave;
    this.run.right.textContent =
      state.countdown ?? (state.enemies === undefined ? '' : `Enemies ${state.enemies}`);
    this.run.right.className = state.countdown === undefined ? '' : 'hud-countdown';
  }

  private addRunLine(): { root: HTMLDivElement; wave: HTMLSpanElement; right: HTMLSpanElement } {
    const root = document.createElement('div');
    root.className = 'hud-run';
    const wave = document.createElement('span');
    wave.className = 'hud-wave';
    const right = document.createElement('span');
    root.append(wave, right);
    this.root.append(root);
    return { root, wave, right };
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
