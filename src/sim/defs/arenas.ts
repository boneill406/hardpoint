import type { ArenaDef, BoxDef } from '../arena/ArenaDef';
import { Vec2 } from '../core/Vec2';

// Arena layouts (GDD §6). The slice arena: 46 × 46, mirror-symmetric left/right,
// player start bottom-centre, gates left, right and top. Starting layout for
// playtesting; tests in tests/sim/defs/arenas.test.ts guard its invariants.

/** Cover-sized crate (u). Smaller than a tank, so it hides a hull but not a turret. */
const CRATE = 1.5;

function box(x: number, z: number, width: number, depth: number): BoxDef {
  return { center: new Vec2(x, z), width, depth };
}

function crate(x: number, z: number): BoxDef {
  return box(x, z, CRATE, CRATE);
}

export const SLICE_ARENA: ArenaDef = {
  name: 'Slice arena',
  width: 46,
  depth: 46,
  wall: { thickness: 1, height: 2 },
  playerStart: { position: new Vec2(0, -19), heading: 0 },
  gates: [
    { name: 'left', position: new Vec2(-23, 4), heading: Math.PI / 2 },
    { name: 'right', position: new Vec2(23, 4), heading: -Math.PI / 2 },
    { name: 'top', position: new Vec2(0, 23), heading: -Math.PI },
  ],
  pillars: [
    box(0, 2, 3, 3), // centre: splits the arena into left and right lanes
    box(-9, -6, 2, 2),
    box(9, -6, 2, 2),
    box(-14, 8, 1.5, 5), // long side walls: cover from the side gates
    box(14, 8, 1.5, 5),
    box(-6, 14, 4, 1.5), // long top walls: cover from the top gate
    box(6, 14, 4, 1.5),
  ],
  crates: [
    crate(-4, -12),
    crate(4, -12),
    crate(-12, -16),
    crate(12, -16),
    crate(-16, -10),
    crate(16, -10),
    crate(0, -5),
    crate(-10, 0),
    crate(10, 0),
    crate(-4, 7),
    crate(4, 7),
    crate(0, 12),
    crate(-18, 16),
    crate(18, 16),
  ],
};
