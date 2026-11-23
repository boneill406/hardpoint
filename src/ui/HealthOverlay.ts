import type { EntityId } from '../sim/core/Entity';
import type { Vec2 } from '../sim/core/Vec2';
import type { Vehicle } from '../sim/vehicles/Vehicle';
import { amountLabel } from './amountLabel';

/** Screen positions in CSS pixels (from `Renderer`), so this file needs no Babylon import. */
export interface OverlayProjector {
  /** Above a vehicle's drawn position. */
  vehicle(id: EntityId): { x: number; y: number } | undefined;
  /** A ground-plane point, `height` u up. */
  point(point: Vec2, height: number): { x: number; y: number } | undefined;
}

const BAR_WIDTH = 56;
/** How long a damage number floats (s), how far it rises (px), and how high above the hit it starts (u). */
const FLOAT = { seconds: 0.9, rise: 36, height: 1.0 };

interface Tag {
  readonly root: HTMLDivElement;
  readonly fill: HTMLDivElement;
  readonly label: HTMLDivElement;
}

interface Floater {
  readonly element: HTMLDivElement;
  readonly point: Vec2;
  /** Sideways nudge (px) so a burst of MG hits doesn't stack into one number. */
  readonly drift: number;
  age: number;
}

/**
 * Debug overlay (`?hp=on`, M3 plan D9): a health bar over every damaged
 * vehicle, and each hit's damage as a number that floats up from where it hit
 * and fades. HTML over the canvas, read-only: it reads vehicle health and
 * `Hit` events and never writes simulation state.
 */
export class HealthOverlay {
  private readonly layer: HTMLDivElement;
  private readonly tags = new Map<EntityId, Tag>();
  private readonly floaters: Floater[] = [];

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

  /** Called for each `Hit` event: starts a damage number at the impact point. */
  recordHit(point: Vec2, damage: number): void {
    const element = document.createElement('div');
    element.textContent = amountLabel(damage);
    Object.assign(element.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      font: 'bold 15px/1 ui-monospace, Menlo, monospace',
      color: '#ffe3a3',
      textShadow: '0 1px 2px #000, 0 0 4px #000',
      whiteSpace: 'nowrap',
    });
    this.layer.append(element);
    // Render-side randomness only (never in the sim).
    this.floaters.push({ element, point, drift: (Math.random() - 0.5) * 20, age: 0 });
  }

  /** Once per frame, after rendering. */
  update(vehicles: readonly Vehicle[], project: OverlayProjector, frameSeconds: number): void {
    this.updateBars(vehicles, project);
    this.updateFloaters(project, frameSeconds);
  }

  dispose(): void {
    this.layer.remove();
  }

  /** A bar over each damaged vehicle; tags for vehicles gone or undamaged are dropped. */
  private updateBars(vehicles: readonly Vehicle[], project: OverlayProjector): void {
    const shown = new Set<EntityId>();
    for (const vehicle of vehicles) {
      const { current, max } = vehicle.health;
      const point = current < max ? project.vehicle(vehicle.id) : undefined;
      if (point === undefined) {
        continue;
      }
      shown.add(vehicle.id);
      const tag = this.tagFor(vehicle.id);
      tag.root.style.transform = `translate(${point.x - BAR_WIDTH / 2}px, ${point.y}px)`;
      tag.fill.style.width = `${(current / max) * 100}%`;
      tag.fill.style.background = current / max > 0.3 ? '#6fcf5b' : '#e0533d';
      tag.label.textContent = `${amountLabel(current)}/${max}`;
    }
    for (const [id, tag] of this.tags) {
      if (!shown.has(id)) {
        tag.root.remove();
        this.tags.delete(id);
      }
    }
  }

  /** Each number rises and fades over its life, re-projected every frame so it stays on its spot as the camera moves. */
  private updateFloaters(project: OverlayProjector, frameSeconds: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const floater = this.floaters[i];
      if (floater === undefined) {
        continue;
      }
      floater.age += frameSeconds;
      const t = floater.age / FLOAT.seconds;
      const at = project.point(floater.point, FLOAT.height);
      if (t >= 1 || at === undefined) {
        floater.element.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      const rise = FLOAT.rise * (1 - (1 - t) * (1 - t));
      floater.element.style.transform = `translate(-50%, -50%) translate(${at.x + floater.drift}px, ${at.y - rise}px)`;
      floater.element.style.opacity = String(t < 0.5 ? 1 : 1 - (t - 0.5) * 2);
    }
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
