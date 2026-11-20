import { PAD_SCHEMES, type PadSchemeName } from '../input/bindings';

/** Debug switches read from the page URL, e.g. `http://localhost:5173/?fps=20&interp=off&pad=direct`. */
export interface DebugParams {
  /** Render at most this many frames per second, to see how the game copes with a slow machine. */
  readonly fps: number | undefined;
  /** false (`?interp=off`) draws raw ticks, to compare against interpolated motion. */
  readonly interpolate: boolean;
  /** Gamepad control scheme (`?pad=tank|direct|triggers`), to compare schemes in play. */
  readonly pad: PadSchemeName;
  /** `?grid=on` draws a 2 u grid on the floor, to judge distances and speed. */
  readonly grid: boolean;
}

/** Parses the query string; invalid values are ignored rather than breaking startup. */
export function readDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search);
  const fps = Number(params.get('fps'));
  return {
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
    interpolate: params.get('interp') !== 'off',
    pad: readPadScheme(params.get('pad')),
    grid: params.get('grid') === 'on',
  };
}

function readPadScheme(value: string | null): PadSchemeName {
  return value !== null && isPadSchemeName(value) ? value : 'tank';
}

/** Own keys only: `in` would also accept inherited names like `toString`. */
function isPadSchemeName(value: string): value is PadSchemeName {
  return Object.hasOwn(PAD_SCHEMES, value);
}
