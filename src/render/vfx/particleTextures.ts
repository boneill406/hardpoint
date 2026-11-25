import { DynamicTexture } from '@babylonjs/core';
import type { Scene, Texture } from '@babylonjs/core';
import type { ParticleTexture } from './effects';

const SIZE = 64;

/**
 * Particle textures drawn in code at startup (M6-1a): a soft dot, a smoke
 * puff and a spark glow. Kenney's CC0 pack (plan D3) blocks automated
 * downloads, and these simple shapes need no files or licences; a downloaded
 * pack can replace this module later without touching the effects.
 */
export function createParticleTextures(scene: Scene): Record<ParticleTexture, Texture> {
  return {
    soft: draw(scene, 'vfx-soft', drawSoft),
    smoke: draw(scene, 'vfx-smoke', drawSmoke),
    spark: draw(scene, 'vfx-spark', drawSpark),
  };
}

type Painter = (context: CanvasRenderingContext2D) => void;

function draw(scene: Scene, name: string, paint: Painter): Texture {
  const texture = new DynamicTexture(name, { width: SIZE, height: SIZE }, scene, false);
  texture.hasAlpha = true;
  const context = texture.getContext() as CanvasRenderingContext2D;
  context.clearRect(0, 0, SIZE, SIZE);
  paint(context);
  texture.update();
  return texture;
}

/** White, fading smoothly to transparent at the edge. */
function drawSoft(context: CanvasRenderingContext2D): void {
  const gradient = radial(context, SIZE / 2, SIZE / 2, SIZE / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, SIZE, SIZE);
}

/**
 * A lumpy puff: overlapping soft blobs, placed by a fixed pseudo-random
 * sequence so the texture is the same every load.
 */
function drawSmoke(context: CanvasRenderingContext2D): void {
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // A soft, nearly full base so the puff fills its quad (a faint centre reads as a dot)...
  const base = radial(context, SIZE / 2, SIZE / 2, SIZE / 2);
  base.addColorStop(0, 'rgba(255,255,255,0.75)');
  base.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  base.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = base;
  context.fillRect(0, 0, SIZE, SIZE);
  // ...with lumps on top for texture.
  for (let i = 0; i < 10; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * SIZE * 0.22;
    const x = SIZE / 2 + Math.cos(angle) * distance;
    const y = SIZE / 2 + Math.sin(angle) * distance;
    const radius = SIZE * (0.18 + random() * 0.14);
    const gradient = radial(context, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, SIZE, SIZE);
  }
}

/** A hot core with a tight glow: reads as a streak once stretched along its motion. */
function drawSpark(context: CanvasRenderingContext2D): void {
  const gradient = radial(context, SIZE / 2, SIZE / 2, SIZE / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, SIZE, SIZE);
}

function radial(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): CanvasGradient {
  return context.createRadialGradient(x, y, 0, x, y, r);
}
