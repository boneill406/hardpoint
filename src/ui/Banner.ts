import type { BannerState } from './waveHud';

const CSS = `
.banner { position: fixed; left: 0; right: 0; top: 26%; text-align: center; pointer-events: none;
  user-select: none; font: 700 44px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.18em;
  text-shadow: 0 2px 0 #000, 0 0 18px rgba(0, 0, 0, 0.7); }
.banner[hidden] { display: none; }
.banner.info { color: #f2e6b8; }
.banner.good { color: #9fef7a; }
.banner.bad { color: #ff6a50; }
.banner.enter { animation: banner-in 0.35s ease-out; }
@keyframes banner-in { from { transform: scale(1.25); color: #fff; } to { transform: scale(1); } }
`;

/**
 * The big centre text of a run (M5-6a, GDD §2): "WAVE n / 5", "WAVE CLEARED",
 * "VICTORY", "DESTROYED". Shown while the mode's phase calls for it; each new
 * text pops in. HTML over the canvas, read-only.
 */
export class Banner {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private shown: string | undefined;

  constructor(parent: HTMLElement) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement('div');
    this.root.className = 'banner';
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Once per frame with what should show now (undefined: nothing). */
  update(banner: BannerState | undefined): void {
    if (banner?.text === this.shown) {
      return;
    }
    this.shown = banner?.text;
    this.root.hidden = banner === undefined;
    if (banner === undefined) {
      return;
    }
    this.root.textContent = banner.text;
    // Re-adding the class restarts the pop-in for each new text.
    this.root.className = `banner ${banner.tone}`;
    void this.root.offsetWidth;
    this.root.classList.add('enter');
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }
}
