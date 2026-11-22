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
   * compare in play; undefined keeps each def's own (`direction`).
   */
  readonly armor: FaceRule | undefined;
  /** `?hp=on` shows health bars and the last hit over damaged vehicles (M3-5). */
  readonly hp: boolean;
  /** Problems with the URL (unknown names or values), for the console. Defaults are used instead. */
  readonly warnings: readonly string[];
}

/** Brendan's pick after trying all three in play (M2 close). */
const DEFAULT_PAD_SCHEME: PadSchemeName = 'triggers';

const KNOWN = ['fps', 'interp', 'pad', 'grid', 'cam', 'armor', 'hp'];
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

  for (const name of ['interp', 'grid', 'hp']) {
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
    hp: params.get('hp') === 'on',
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
