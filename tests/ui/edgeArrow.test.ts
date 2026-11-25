import { describe, expect, it } from 'vitest';
import { edgeArrow } from '../../src/ui/edgeArrow';

const W = 1000;
const H = 600;
const M = 30;

describe('edgeArrow', () => {
  it('none while the target is on screen inside the margin', () => {
    expect(edgeArrow({ x: 500, y: 300 }, W, H, M)).toBeUndefined();
    expect(edgeArrow({ x: 31, y: 569 }, W, H, M)).toBeUndefined();
  });

  it('straight right of centre: on the right border, pointing right', () => {
    const arrow = edgeArrow({ x: 1400, y: 300 }, W, H, M);
    expect(arrow?.x).toBeCloseTo(970, 9);
    expect(arrow?.y).toBeCloseTo(300, 9);
    expect(arrow?.angle).toBeCloseTo(0, 9);
  });

  it('above the view: on the top border, pointing up', () => {
    const arrow = edgeArrow({ x: 500, y: -200 }, W, H, M);
    expect(arrow?.y).toBeCloseTo(30, 9);
    expect(arrow?.x).toBeCloseTo(500, 9);
    expect(arrow?.angle).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('off a corner: stays on the border, along the line from the centre', () => {
    const arrow = edgeArrow({ x: 2000, y: 1500 }, W, H, M);
    if (arrow === undefined) throw new Error('expected an arrow');
    const onRight = Math.abs(arrow.x - 970) < 1e-9;
    const onBottom = Math.abs(arrow.y - 570) < 1e-9;
    expect(onRight || onBottom).toBe(true);
    expect(arrow.x).toBeLessThanOrEqual(970 + 1e-9);
    expect(arrow.y).toBeLessThanOrEqual(570 + 1e-9);
    expect(arrow.angle).toBeCloseTo(Math.atan2(1200, 1500), 9);
  });

  it('just inside the margin band counts as off-screen (would be hidden by the edge)', () => {
    expect(edgeArrow({ x: 10, y: 300 }, W, H, M)?.x).toBeCloseTo(30, 9);
  });
});
