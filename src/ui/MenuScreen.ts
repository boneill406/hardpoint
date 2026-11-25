import { MenuNavigator } from './MenuNavigator';

/** What a screen shows: a heading, optional lines under it, and the choices. */
export interface MenuContent {
  readonly title: string;
  readonly tone?: 'info' | 'good' | 'bad';
  readonly lines?: readonly string[];
  /** Buttons, top to bottom; the first is the default. Empty for "press any key". */
  readonly items: readonly string[];
}

const CSS = `
.menu { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; background: rgba(10, 11, 10, 0.62); color: #e6e6dc;
  font: 14px/1.3 ui-monospace, Menlo, monospace; letter-spacing: 0.08em; user-select: none; }
.menu[hidden] { display: none; }
.menu-title { font: 700 48px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.2em; color: #f2e6b8;
  text-shadow: 0 2px 0 #000; margin-bottom: 6px; }
.menu-title.good { color: #9fef7a; }
.menu-title.bad { color: #ff6a50; }
.menu-line { opacity: 0.85; text-transform: uppercase; }
.menu-items { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; min-width: 200px; }
.menu-item { font: inherit; letter-spacing: inherit; text-transform: uppercase; color: inherit;
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 8px 16px; cursor: pointer; }
.menu-item.selected { background: #f2e6b8; color: #141414; border-color: #f2e6b8; }
`;

/**
 * A full-screen menu over the game (M5-4, plan D8): title, pause and summary
 * all use it. Mouse hover and click work directly; keyboard and pad go through
 * `move` and `confirm`, called by the app from `MenuInput`.
 */
export class MenuScreen {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly navigator = new MenuNavigator(0);
  private buttons: HTMLButtonElement[] = [];

  constructor(
    parent: HTMLElement,
    private readonly onChoose: (index: number) => void,
  ) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.hidden = true;
    parent.append(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(content: MenuContent): void {
    this.root.replaceChildren();
    const title = document.createElement('div');
    title.className = `menu-title ${content.tone ?? 'info'}`;
    title.textContent = content.title;
    this.root.append(title);
    for (const text of content.lines ?? []) {
      const line = document.createElement('div');
      line.className = 'menu-line';
      line.textContent = text;
      this.root.append(line);
    }
    const list = document.createElement('div');
    list.className = 'menu-items';
    this.buttons = content.items.map((label, index) => {
      const button = document.createElement('button');
      button.className = 'menu-item';
      button.textContent = label;
      button.addEventListener('pointerenter', () => this.highlight(index));
      button.addEventListener('click', () => this.onChoose(index));
      list.append(button);
      return button;
    });
    if (this.buttons.length > 0) {
      this.root.append(list);
    }
    this.navigator.reset(this.buttons.length);
    this.highlight(0);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Arrow keys, D-pad or stick. */
  move(delta: number): void {
    this.navigator.move(delta);
    this.highlight(this.navigator.index);
  }

  /** Enter / Space / A: choose the highlighted item. */
  confirm(): void {
    if (this.buttons.length > 0) {
      this.onChoose(this.navigator.index);
    }
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }

  private highlight(index: number): void {
    this.navigator.set(index);
    this.buttons.forEach((button, i) => {
      button.classList.toggle('selected', i === this.navigator.index);
    });
  }
}
