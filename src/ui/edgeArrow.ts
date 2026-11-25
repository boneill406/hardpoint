/** A screen point in CSS pixels. */
export interface ScreenXY {
  readonly x: number;
  readonly y: number;
}

/** Where to draw an edge arrow and which way it points (radians, 0 = right, clockwise, CSS rotate). */
export interface EdgeArrow {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * For something drawn at `target` (possibly off-screen), where its arrow goes
 * on a `width` × `height` view (M5-6b, GDD §7): undefined while it's on screen
 * (inside the `margin` border); otherwise the point where the line from the
 * screen centre to it crosses the border inset by `margin`, pointing at it.
 */
export function edgeArrow(
  target: ScreenXY,
  width: number,
  height: number,
  margin: number,
): EdgeArrow | undefined {
  const inside =
    target.x >= margin &&
    target.x <= width - margin &&
    target.y >= margin &&
    target.y <= height - margin;
  if (inside) {
    return undefined;
  }
  const cx = width / 2;
  const cy = height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const halfW = Math.max(0, cx - margin);
  const halfH = Math.max(0, cy - margin);
  // Scale the centre→target vector so it just reaches the inset border.
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy),
  );
  return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dy, dx) };
}
