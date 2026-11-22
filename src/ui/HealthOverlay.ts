import type { ArmorFace } from '../sim/combat/ArmorDef';
import type { EntityId } from '../sim/core/Entity';
import type { Vehicle } from '../sim/vehicles/Vehicle';

/** Projects a vehicle to CSS pixels on the canvas (`Renderer.screenPositionOf`). */
export type ScreenProjector = (id: EntityId) => { x: number; y: number } | undefined;

/** What the overlay remembers about a vehicle's last hit. */
export interface LastHit {
  readonly damage: number;
  readonly face: ArmorFace;
}

/** "−32.5 front": the damage actually dealt and the face it counted against. */
export function hitLabel(hit: LastHit): string {
  return `−${formatDamage(hit.damage)} ${hit.face}`;
}

/** Whole numbers plain, otherwise one decimal (32.5, 3, 62.5). */
function formatDamage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const BAR_WIDTH = 56;

interface Tag {
  readonly root: HTMLDivElement;
  readonly fill: HTMLDivElement;
  readonly label: HTMLDivElement;
}

/**
 * Debug overlay (`?hp=on`, M3 plan D9): a health bar over every damaged
 * vehicle and the last hit it took ("−32.5 front"), for checking armor in
 * play. HTML over the canvas, read-only: it reads vehicle health and `Hit`
 * events and never writes simulation state. Enemy health bars aren't in the
 * GDD, so this stays debug-only.
 */
export class HealthOverlay {
  private readonly layer: HTMLDivElement;
  private readonly tags = new Map<EntityId, Tag>();
  private readonly lastHits = new Map<EntityId, LastHit>();

  constructor(parent: HTMLElement, armorRule: string) {
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      font: '12px/1.2 ui-monospace, Menlo, monospace',
      color: '#f2f2f2',
      textShadow: '0 1px 2px #000',
    });
    const rule = document.createElement('div');
    rule.textContent = `armor rule: ${armorRule}`;
    Object.assign(rule.style, { position: 'absolute', left: '12px', top: '10px', opacity: '0.8' });
    this.layer.append(rule);
    parent.append(this.layer);
  }

  /** Called for each `Hit` event. */
  recordHit(target: EntityId, hit: LastHit): void {
    this.lastHits.set(target, hit);
  }

  /** Once per frame, after rendering: places a tag over each damaged vehicle, drops tags for vehicles gone. */
  update(vehicles: readonly Vehicle[], project: ScreenProjector): void {
    const shown = new Set<EntityId>();
    for (const vehicle of vehicles) {
      const { current, max } = vehicle.health;
      const point = current < max ? project(vehicle.id) : undefined;
      if (point === undefined) {
        continue;
      }
      shown.add(vehicle.id);
      const tag = this.tagFor(vehicle.id);
      tag.root.style.transform = `translate(${point.x - BAR_WIDTH / 2}px, ${point.y}px)`;
      tag.fill.style.width = `${(current / max) * 100}%`;
      tag.fill.style.background = current / max > 0.3 ? '#6fcf5b' : '#e0533d';
      const hit = this.lastHits.get(vehicle.id);
      tag.label.textContent = `${formatDamage(current)}/${max}${hit === undefined ? '' : `  ${hitLabel(hit)}`}`;
    }
    for (const [id, tag] of this.tags) {
      if (!shown.has(id)) {
        tag.root.remove();
        this.tags.delete(id);
      }
    }
    for (const id of this.lastHits.keys()) {
      if (!vehicles.some((vehicle) => vehicle.id === id)) {
        this.lastHits.delete(id);
      }
    }
  }

  dispose(): void {
    this.layer.remove();
  }

  private tagFor(id: EntityId): Tag {
    const existing = this.tags.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${BAR_WIDTH}px`,
    });
    const bar = document.createElement('div');
    Object.assign(bar.style, { height: '5px', background: '#000a', border: '1px solid #000' });
    const fill = document.createElement('div');
    Object.assign(fill.style, { height: '100%' });
    bar.append(fill);
    const label = document.createElement('div');
    Object.assign(label.style, { marginTop: '2px', whiteSpace: 'nowrap' });
    root.append(bar, label);
    this.layer.append(root);
    const tag = { root, fill, label };
    this.tags.set(id, tag);
    return tag;
  }
}
