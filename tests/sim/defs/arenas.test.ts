import { describe, expect, it } from 'vitest';
import type { BoxDef } from '../../../src/sim/arena/ArenaDef';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { PLAYER_TANK } from '../../../src/sim/defs/vehicles';

// Invariants the slice layout must keep while it is tuned (GDD §6), not the exact layout.

const obstacles: readonly BoxDef[] = [...SLICE_ARENA.pillars, ...SLICE_ARENA.crates];
const halfWidth = SLICE_ARENA.width / 2;
const halfDepth = SLICE_ARENA.depth / 2;
/** Enough room to drive a tank past: hull width plus a little. */
const LANE = PLAYER_TANK.hull.width + 0.5;
/** Clear ground needed in front of a gate for a tank to emerge (u). */
const GATE_APRON = 4;
/** Clear radius around the player start: half the hull diagonal plus room to turn. */
const START_CLEARANCE = Math.hypot(PLAYER_TANK.hull.length, PLAYER_TANK.hull.width) / 2 + 1.5;

/** Shortest distance from a point to an axis-aligned box (0 if inside). */
function distanceToBox(point: Vec2, box: BoxDef): number {
  const dx = Math.max(Math.abs(point.x - box.center.x) - box.width / 2, 0);
  const dz = Math.max(Math.abs(point.z - box.center.z) - box.depth / 2, 0);
  return Math.hypot(dx, dz);
}

/** Gap between two axis-aligned boxes along the axis where they are furthest apart (negative = overlap). */
function gapBetween(a: BoxDef, b: BoxDef): number {
  const gapX = Math.abs(a.center.x - b.center.x) - (a.width + b.width) / 2;
  const gapZ = Math.abs(a.center.z - b.center.z) - (a.depth + b.depth) / 2;
  return Math.max(gapX, gapZ);
}

describe('SLICE_ARENA', () => {
  it('matches the GDD: 46 × 46, 6–8 pillars, 12–16 crates, 3 gates', () => {
    expect([SLICE_ARENA.width, SLICE_ARENA.depth]).toEqual([46, 46]);
    expect(SLICE_ARENA.pillars.length).toBeGreaterThanOrEqual(6);
    expect(SLICE_ARENA.pillars.length).toBeLessThanOrEqual(8);
    expect(SLICE_ARENA.crates.length).toBeGreaterThanOrEqual(12);
    expect(SLICE_ARENA.crates.length).toBeLessThanOrEqual(16);
    expect(SLICE_ARENA.gates.map((gate) => gate.name).sort()).toEqual(['left', 'right', 'top']);
  });

  it('keeps every obstacle on the floor, with a tank-width lane to the walls or touching none', () => {
    for (const box of obstacles) {
      const toWallX = halfWidth - (Math.abs(box.center.x) + box.width / 2);
      const toWallZ = halfDepth - (Math.abs(box.center.z) + box.depth / 2);
      expect(Math.min(toWallX, toWallZ)).toBeGreaterThanOrEqual(LANE);
    }
  });

  it('never overlaps obstacles, and leaves a lane a tank fits through between any two', () => {
    for (let i = 0; i < obstacles.length; i++) {
      for (let j = i + 1; j < obstacles.length; j++) {
        const a = obstacles[i];
        const b = obstacles[j];
        if (a !== undefined && b !== undefined) {
          expect(gapBetween(a, b), `obstacles ${i} and ${j}`).toBeGreaterThanOrEqual(LANE);
        }
      }
    }
  });

  it('puts each gate on a wall, facing into the arena, with clear ground in front', () => {
    for (const gate of SLICE_ARENA.gates) {
      const onSideWall = Math.abs(Math.abs(gate.position.x) - halfWidth) < 1e-9;
      const onEndWall = Math.abs(Math.abs(gate.position.z) - halfDepth) < 1e-9;
      expect(onSideWall || onEndWall, gate.name).toBe(true);

      const facing = Vec2.fromHeading(gate.heading);
      expect(facing.dot(gate.position.scale(-1)), `${gate.name} faces inward`).toBeGreaterThan(0);

      const apronCentre = gate.position.add(facing.scale(GATE_APRON / 2));
      for (const box of obstacles) {
        expect(distanceToBox(apronCentre, box), gate.name).toBeGreaterThan(GATE_APRON / 2);
      }
    }
  });

  it('starts the player bottom-centre, facing up-screen, clear of obstacles', () => {
    const { position, heading } = SLICE_ARENA.playerStart;
    expect(position.x).toBe(0);
    expect(position.z).toBeLessThan(-halfDepth / 2);
    expect(heading).toBe(0);
    for (const box of obstacles) {
      expect(distanceToBox(position, box)).toBeGreaterThan(START_CLEARANCE);
    }
  });

  it('is mirror-symmetric left/right, so neither side gate is easier', () => {
    const mirrored = (box: BoxDef): string =>
      `${-box.center.x},${box.center.z},${box.width},${box.depth}`;
    const key = (box: BoxDef): string =>
      `${box.center.x},${box.center.z},${box.width},${box.depth}`;
    const keys = new Set(obstacles.map(key));
    for (const box of obstacles) {
      expect(keys.has(mirrored(box)), key(box)).toBe(true);
    }
  });
});
