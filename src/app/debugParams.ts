import { PAD_SCHEMES, type PadSchemeName } from '../input/bindings';
import { CAMERA_PRESETS, type CameraPresetName } from '../render/camera/SliceCamera';
import type { FaceRule } from '../sim/combat/ArmorDef';

/** Debug switches read from the page URL, e.g. `http://localhost:5173/?fps=20&interp=off&pad=direct`. */
export interface DebugParams {
  /** Render at most this many frames per second, to see how the game copes with a slow machine. */
  readonly fps: number | undefined;
  /** false (`?interp=off`) draws raw ticks, to compare against interpolated motion. */
  readonly interpolate: boolean;
  /** Gamepad control scheme (`?pad=tank|direct|triggers`); `triggers` unless overridden. */
  readonly pad: PadSchemeName;
  /** `?grid=on` draws a 2 u grid on the floor, to judge distances and speed. */
  readonly grid: boolean;
  /** Camera preset (`?cam=slice|proto`), to compare framings in play. */
  readonly cam: CameraPresetName;
  /**
   * Armor face rule for every tank (`?armor=direction|struck`, M3 plan D5), to
   * compare in play; undefined keeps each def's own (`struck` since the M3 pick).
   */
  readonly armor: FaceRule | undefined;
  /**
   * Health bars and floating damage numbers over damaged vehicles (M3-5). On by
   * default since M3 close (Brendan); `?hp=off` hides them.
   */
  readonly hp: boolean;
  /**
   * `waves` (default): the real run, wave survival (M5). `sandbox`: the debug
   * scene from M4 (player plus `?enemies=` hunters, `?dummies=`), no waves.
   */
  readonly mode: GameModeName;
  /** `?wave=N` starts the run at wave N (1–5), for testing later waves. */
  readonly wave: number;
  /**
   * `?seed=N` pins every run's seed, to replay one (M5 plan D9); without it
   * each run gets a new random seed (shown on the summary).
   */
  readonly seed: number | undefined;
  /** Hunting insurgents in the debug scene (`?enemies=0..3`, default 1), from the top, left, right gates. */
  readonly enemies: number;
  /** `?dummies=on` adds the M3 armor dummies. */
  readonly dummies: boolean;
  /** `?ai=on` draws each enemy's path, firing spot and state. */
  readonly ai: boolean;
  /** `?nav=on` tints the cells enemies may not drive on. */
  readonly nav: boolean;
  /** Problems with the URL (unknown names or values), for the console. Defaults are used instead. */
  readonly warnings: readonly string[];
}

export type GameModeName = 'waves' | 'sandbox';

/** Brendan's pick after trying all three in play (M2 close). */
const DEFAULT_PAD_SCHEME: PadSchemeName = 'triggers';

const KNOWN = [
  'fps',
  'interp',
  'pad',
  'grid',
  'cam',
  'armor',
  'hp',
  'enemies',
  'dummies',
  'ai',
  'nav',
  'mode',
  'wave',
  'seed',
];
const MODES: readonly GameModeName[] = ['waves', 'sandbox'];
/** Must match the number of waves in `defs/waves.ts` (a test checks). */
export const MAX_WAVE = 5;
const DEFAULT_ENEMIES = 1;
const MAX_ENEMIES = 3;
const FACE_RULES: readonly FaceRule[] = ['direction', 'struck'];
const ON_OFF = ['on', 'off'];

/**
 * Parses the query string. Invalid values fall back to defaults rather than
 * breaking startup, but are reported in `warnings` so a typo isn't silent.
 */
export function readDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search);
  const warnings: string[] = [];
  const warn = (name: string, value: string, expected: string): void => {
    const hint = value.includes('?') ? ' (separate parameters with &, not ?)' : '';
    warnings.push(`Ignoring ?${name}=${value}: expected ${expected}${hint}`);
  };

  for (const name of params.keys()) {
    if (!KNOWN.includes(name)) {
      warnings.push(`Unknown debug parameter "${name}" (known: ${KNOWN.join(', ')})`);
    }
  }

  const fpsText = params.get('fps');
  const fps = Number(fpsText);
  const fpsValid = fpsText !== null && Number.isFinite(fps) && fps > 0;
  if (fpsText !== null && !fpsValid) {
    warn('fps', fpsText, 'a positive number');
  }

  const pad = params.get('pad');
  const padValid = pad !== null && isPadSchemeName(pad);
  if (pad !== null && !padValid) {
    warn('pad', pad, Object.keys(PAD_SCHEMES).join(' | '));
  }

  const cam = params.get('cam');
  const camValid = cam !== null && isCameraPresetName(cam);
  if (cam !== null && !camValid) {
    warn('cam', cam, Object.keys(CAMERA_PRESETS).join(' | '));
  }

  const armor = params.get('armor');
  const armorValid = armor !== null && isFaceRule(armor);
  if (armor !== null && !armorValid) {
    warn('armor', armor, FACE_RULES.join(' | '));
  }

  const enemiesText = params.get('enemies');
  const enemies = Number(enemiesText);
  const enemiesValid =
    enemiesText !== null && Number.isInteger(enemies) && enemies >= 0 && enemies <= MAX_ENEMIES;
  if (enemiesText !== null && !enemiesValid) {
    warn('enemies', enemiesText, `a whole number 0–${MAX_ENEMIES}`);
  }

  const mode = params.get('mode');
  const modeValid = mode !== null && isGameModeName(mode);
  if (mode !== null && !modeValid) {
    warn('mode', mode, MODES.join(' | '));
  }

  const waveText = params.get('wave');
  const wave = Number(waveText);
  const waveValid = waveText !== null && Number.isInteger(wave) && wave >= 1 && wave <= MAX_WAVE;
  if (waveText !== null && !waveValid) {
    warn('wave', waveText, `a whole number 1–${MAX_WAVE}`);
  }

  const seedText = params.get('seed');
  const seed = Number(seedText);
  const seedValid = seedText !== null && Number.isInteger(seed) && seed >= 0;
  if (seedText !== null && !seedValid) {
    warn('seed', seedText, 'a whole number ≥ 0');
  }

  for (const name of ['interp', 'grid', 'hp', 'dummies', 'ai', 'nav']) {
    const value = params.get(name);
    if (value !== null && !ON_OFF.includes(value)) {
      warn(name, value, 'on | off');
    }
  }

  return {
    fps: fpsValid ? fps : undefined,
    interpolate: params.get('interp') !== 'off',
    pad: padValid ? pad : DEFAULT_PAD_SCHEME,
    grid: params.get('grid') === 'on',
    cam: camValid ? cam : 'slice',
    armor: armorValid ? armor : undefined,
    hp: params.get('hp') !== 'off',
    mode: modeValid ? mode : 'waves',
    wave: waveValid ? wave : 1,
    seed: seedValid ? seed : undefined,
    enemies: enemiesValid ? enemies : DEFAULT_ENEMIES,
    dummies: params.get('dummies') === 'on',
    ai: params.get('ai') === 'on',
    nav: params.get('nav') === 'on',
    warnings,
  };
}

/** Own keys only: `in` would also accept inherited names like `toString`. */
function isPadSchemeName(value: string): value is PadSchemeName {
  return Object.hasOwn(PAD_SCHEMES, value);
}

function isCameraPresetName(value: string): value is CameraPresetName {
  return Object.hasOwn(CAMERA_PRESETS, value);
}

function isFaceRule(value: string): value is FaceRule {
  return (FACE_RULES as readonly string[]).includes(value);
}

function isGameModeName(value: string): value is GameModeName {
  return (MODES as readonly string[]).includes(value);
}
