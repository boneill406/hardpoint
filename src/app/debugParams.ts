/** Debug switches read from the page URL, e.g. `http://localhost:5173/?fps=20&interp=off`. */
export interface DebugParams {
  /** Render at most this many frames per second, to see how the game copes with a slow machine. */
  readonly fps: number | undefined;
  /** false (`?interp=off`) draws raw ticks, to compare against interpolated motion. */
  readonly interpolate: boolean;
}

/** Parses the query string; invalid values are ignored rather than breaking startup. */
export function readDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search);
  const fps = Number(params.get('fps'));
  return {
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
    interpolate: params.get('interp') !== 'off',
  };
}
