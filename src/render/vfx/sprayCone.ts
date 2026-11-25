/** A 3D direction in Babylon axes (x, y up, z). Plain numbers, so this file needs no Babylon import. */
export interface Dir3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The two corner directions of an impact's spray (M6-1a). Particles launch in
 * a random direction between them (Babylon's box emitter picks each component
 * between `direction1` and `direction2`). The spray leaves the surface along
 * its ground-plane `normal` (sim x, z), leaning up by `lift` (0 = flat, 1 =
 * straight up), widened sideways and vertically by `spread`.
 *
 * Without a normal (a zero vector) the spray goes up and out in every direction.
 */
export function sprayCone(
  normal: { readonly x: number; readonly z: number },
  lift: number,
  spread: number,
): readonly [Dir3, Dir3] {
  const length = Math.hypot(normal.x, normal.z);
  if (length === 0) {
    return [
      { x: -spread, y: lift, z: -spread },
      { x: spread, y: lift + spread, z: spread },
    ];
  }
  const nx = normal.x / length;
  const nz = normal.z / length;
  // Sideways on the ground: the normal turned 90°.
  const sx = -nz;
  const sz = nx;
  const out = 1 - lift;
  return [
    { x: nx * out - sx * spread, y: lift * (1 - spread * 0.5), z: nz * out - sz * spread },
    { x: nx * out + sx * spread, y: lift + spread * 0.5, z: nz * out + sz * spread },
  ];
}
