import { edgeArrow, type ScreenXY } from './edgeArrow';

/** Something that may be off-screen: an enemy tank, or a gate about to spawn. */
export interface EdgeTarget {
  readonly key: string;
  readonly kind: 'enemy' | 'gate';
  /** Where it is drawn (CSS pixels, may be outside the view); undefined to skip. */
  readonly at: ScreenXY | undefined;
}

/** Inset (px) of the arrows from the screen edge. */
const MARGIN = 26;
const COLOURS = { enemy: '#ff6a50', gate: '#f2c94c', gateDim: '#8a6f1c' };
/** Gate arrows blink this many times a second, like the gate panel (M5-2). */
const GATE_BLINKS_PER_SECOND = 4;

interface Arrow {
  readonly root: HTMLDivElement;
  readonly shape: SVGPathElement;
}

/**
 * Arrows at the screen edge (M5-6b, GDD §7): one per enemy outside the view,
 * and one per gate about to spawn outside it (blinking, for its 1 s warning).
 * The arena is bigger than one screen, so this is how you know where trouble
 * is. HTML over the canvas, read-only; the placement is `edgeArrow`.
 *
 * Colours change per frame in script, not by CSS animation: animated, moving
 * HTML over the canvas leaves stale paint in Safari (M3-6, M4-5d).
 */
export class EdgeIndicators {
  private readonly layer: HTMLDivElement;
  private readonly arrows = new Map<string, Arrow>();
  /** Gate name → seconds of warning left. */
  private readonly gates = new Map<string, number>();
  private clock = 0;

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    parent.append(this.layer);
  }

  /** `GateWarning`: point at this gate (if off-screen) until its tanks are out. */
  warnGate(gate: string, seconds: number): void {
    this.gates.set(gate, seconds);
  }

  /** Gates still in their warning, for the caller to project. */
  get warnedGates(): string[] {
    return [...this.gates.keys()];
  }

  /** Once per frame, after rendering. */
  update(
    targets: readonly EdgeTarget[],
    width: number,
    height: number,
    frameSeconds: number,
  ): void {
    this.clock += frameSeconds;
    for (const [gate, left] of this.gates) {
      const next = left - frameSeconds;
      if (next <= 0) {
        this.gates.delete(gate);
      } else {
        this.gates.set(gate, next);
      }
    }
    const shown = new Set<string>();
    for (const target of targets) {
      const arrow = target.at && edgeArrow(target.at, width, height, MARGIN);
      if (arrow === undefined) {
        continue;
      }
      shown.add(target.key);
      const element = this.arrowFor(target.key, target.kind);
      element.root.style.transform = `translate(${arrow.x}px, ${arrow.y}px) translate(-50%, -50%) rotate(${arrow.angle}rad)`;
      element.shape.setAttribute('fill', this.colourOf(target.kind));
    }
    for (const [key, arrow] of this.arrows) {
      if (!shown.has(key)) {
        arrow.root.remove();
        this.arrows.delete(key);
      }
    }
  }

  dispose(): void {
    this.layer.remove();
    this.arrows.clear();
  }

  private colourOf(kind: EdgeTarget['kind']): string {
    if (kind === 'enemy') {
      return COLOURS.enemy;
    }
    const lit = Math.floor(this.clock * GATE_BLINKS_PER_SECOND * 2) % 2 === 0;
    return lit ? COLOURS.gate : COLOURS.gateDim;
  }

  private arrowFor(key: string, kind: EdgeTarget['kind']): Arrow {
    const existing = this.arrows.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const size = kind === 'gate' ? 32 : 26;
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size}px`,
    });
    // A chevron pointing right (+x); rotated to face the target.
    root.innerHTML = `
      <svg viewBox="0 0 20 20" width="${size}" height="${size}" style="display:block;overflow:visible">
        <path d="M4 3 L17 10 L4 17 L7 10 Z" stroke="#141414" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
    const shape = root.querySelector('path');
    if (!(shape instanceof SVGPathElement)) {
      throw new Error('Edge arrow is missing its shape');
    }
    this.layer.append(root);
    const arrow = { root, shape };
    this.arrows.set(key, arrow);
    return arrow;
  }
}
