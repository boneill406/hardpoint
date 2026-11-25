import type { EntityId } from '../sim/core/Entity';
import { telegraphSignFrame } from './telegraphSign';

/** Finds where a weapon's muzzle is on screen (CSS pixels); undefined if the shooter is gone or off-screen. */
export type MuzzleLocator = (
  shooter: EntityId,
  hardpoint: string,
) => { x: number; y: number } | undefined;

/** Sign width (px); the triangle is drawn in a 40 × 36 box. */
const WIDTH = 24;
/** Gap (px) between the muzzle and the sign's bottom edge. */
const LIFT = 6;

const COLOURS = {
  edge: '#141414',
  /** Unfilled part: dark amber, so the black "!" still reads on it. */
  dim: '#8a5c00',
  /** Filled part: hazard yellow. */
  bright: '#ffc21a',
};

const TRIANGLE = 'M20 3 L37 33 L3 33 Z';

interface Sign {
  readonly root: HTMLDivElement;
  /** The clip rectangle that reveals the bright fill from the bottom up. */
  readonly reveal: SVGRectElement;
  /** Orange outline behind the sign: a soft glow, brighter while blinking. */
  readonly glow: SVGPathElement;
  readonly shooter: EntityId;
  readonly hardpoint: string;
  readonly seconds: number;
  age: number;
}

let nextClipId = 0;

/**
 * The enemy fire telegraph (M4-5b, GDD §5): a hazard-label triangle with "!"
 * over the muzzle of a gun that is winding up. It fills with yellow from the
 * bottom over the windup, so a full sign means the shot; it blinks over the
 * last stretch. Shown on `ShotTelegraphed`, removed on `ShotFired`,
 * `TelegraphCancelled`, or if the shooter is gone. HTML over the canvas: a
 * fixed size on screen, so it reads at any distance. Read-only.
 */
export class TelegraphSigns {
  private readonly layer: HTMLDivElement;
  private readonly signs = new Map<string, Sign>();

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    parent.append(this.layer);
  }

  start(shooter: EntityId, hardpoint: string, seconds: number): void {
    this.end(shooter, hardpoint);
    const { root, reveal, glow } = buildSign();
    this.layer.append(root);
    this.signs.set(key(shooter, hardpoint), {
      root,
      reveal,
      glow,
      shooter,
      hardpoint,
      seconds,
      age: 0,
    });
  }

  end(shooter: EntityId, hardpoint: string): void {
    const id = key(shooter, hardpoint);
    this.signs.get(id)?.root.remove();
    this.signs.delete(id);
  }

  /** Once per frame, after rendering: animates each sign and keeps it over its muzzle. */
  update(locate: MuzzleLocator, frameSeconds: number): void {
    for (const sign of [...this.signs.values()]) {
      sign.age += frameSeconds;
      const frame = telegraphSignFrame(sign.age, sign.seconds);
      const at = locate(sign.shooter, sign.hardpoint);
      if (frame.expired || at === undefined) {
        this.end(sign.shooter, sign.hardpoint);
        continue;
      }
      const filled = 36 * frame.fill;
      sign.reveal.setAttribute('y', String(36 - filled));
      sign.reveal.setAttribute('height', String(filled));
      const blink = frame.urgent && Math.floor(sign.age / 0.05) % 2 === 0;
      // The glow is a shape inside the SVG, not a CSS filter: Safari leaves stale paint
      // behind filtered elements that move every frame (reddish smears, M4-5d).
      sign.glow.setAttribute('opacity', blink ? '0.95' : '0.35');
      sign.glow.setAttribute('stroke-width', blink ? '9' : '6');
      sign.root.style.transform = `translate(${at.x}px, ${at.y - LIFT}px) translate(-50%, -100%) scale(${frame.scale})`;
    }
  }

  dispose(): void {
    this.layer.remove();
    this.signs.clear();
  }
}

function key(shooter: EntityId, hardpoint: string): string {
  return `${shooter}/${hardpoint}`;
}

/** The triangle: dark amber base, a yellow copy revealed by a growing clip rect, black edge and "!". */
function buildSign(): { root: HTMLDivElement; reveal: SVGRectElement; glow: SVGPathElement } {
  const clipId = `telegraph-fill-${nextClipId++}`;
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${WIDTH}px`,
    transformOrigin: '50% 100%',
  });
  root.innerHTML = `
    <svg viewBox="0 0 40 36" width="${WIDTH}" style="display:block;overflow:visible">
      <defs><clipPath id="${clipId}"><rect x="0" y="36" width="40" height="0"/></clipPath></defs>
      <path d="${TRIANGLE}" fill="#000" opacity="0.45" transform="translate(0 1.5)"/>
      <path class="glow" d="${TRIANGLE}" fill="none" stroke="#ff5a1a" stroke-width="6" stroke-linejoin="round" opacity="0.35"/>
      <path d="${TRIANGLE}" fill="${COLOURS.dim}"/>
      <path d="${TRIANGLE}" fill="${COLOURS.bright}" clip-path="url(#${clipId})"/>
      <path d="${TRIANGLE}" fill="none" stroke="${COLOURS.edge}" stroke-width="3.5" stroke-linejoin="round"/>
      <rect x="18" y="12" width="4" height="12" rx="1.5" fill="${COLOURS.edge}"/>
      <circle cx="20" cy="28.5" r="2.2" fill="${COLOURS.edge}"/>
    </svg>`;
  const reveal = root.querySelector(`#${clipId} rect`);
  const glow = root.querySelector('.glow');
  if (!(reveal instanceof SVGRectElement) || !(glow instanceof SVGPathElement)) {
    throw new Error('Telegraph sign is missing its fill clip or glow');
  }
  return { root, reveal, glow };
}
