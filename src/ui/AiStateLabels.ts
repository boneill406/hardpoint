import type { EntityId } from '../sim/core/Entity';
import { AiController } from '../sim/vehicles/controllers/AiController';
import type { Vehicle } from '../sim/vehicles/Vehicle';

/** Projects a vehicle to CSS pixels (from `Renderer.screenPositionOf`). */
export type VehicleProjector = (id: EntityId) => { x: number; y: number } | undefined;

/**
 * Debug labels (`?ai=on`, M4 plan D15): each AI tank's state ("advance",
 * "engage", "reposition") above it. HTML over the canvas, read-only.
 */
export class AiStateLabels {
  private readonly layer: HTMLDivElement;
  private readonly labels = new Map<EntityId, HTMLDivElement>();

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      font: '11px/1 ui-monospace, Menlo, monospace',
      color: '#8fdcff',
      textShadow: '0 1px 2px #000',
    });
    parent.append(this.layer);
  }

  update(vehicles: readonly Vehicle[], project: VehicleProjector): void {
    const shown = new Set<EntityId>();
    for (const vehicle of vehicles) {
      const at = project(vehicle.id);
      if (!(vehicle.controller instanceof AiController) || at === undefined) {
        continue;
      }
      shown.add(vehicle.id);
      const label = this.labelFor(vehicle.id);
      label.textContent = vehicle.controller.debug.state;
      label.style.transform = `translate(-50%, -100%) translate(${at.x}px, ${at.y}px)`;
    }
    for (const [id, label] of this.labels) {
      if (!shown.has(id)) {
        label.remove();
        this.labels.delete(id);
      }
    }
  }

  dispose(): void {
    this.layer.remove();
  }

  private labelFor(id: EntityId): HTMLDivElement {
    const existing = this.labels.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const label = document.createElement('div');
    Object.assign(label.style, { position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap' });
    this.layer.append(label);
    this.labels.set(id, label);
    return label;
  }
}
