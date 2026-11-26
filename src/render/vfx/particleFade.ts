import { Color4 } from '@babylonjs/core';
import type { ParticleSystem } from '@babylonjs/core';
import type { Rgba } from './effects';

/** Start colour, held until `fadeFrom` of the particle's life, then a blend to the end colour. */
export function addFade(system: ParticleSystem, start: Rgba, end: Rgba, fadeFrom: number): void {
  system.addColorGradient(0, new Color4(...start));
  if (fadeFrom > 0) {
    system.addColorGradient(fadeFrom, new Color4(...start));
  }
  system.addColorGradient(1, new Color4(...end));
}
