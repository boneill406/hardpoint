import { Renderer } from '../render/Renderer';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop. M0: rendering plus a physics smoke check; the fixed-step
 * simulation (which will own the physics world) joins in M1.
 */
function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
}

async function start(): Promise<void> {
  // The simulation can't run without physics, so load Rapier's WASM before anything else.
  const physics = await RapierPhysicsWorld.create();
  physics.step(1 / 60);
  console.info('Physics ready: Rapier 2D');

  const renderer = new Renderer(getCanvas());
  window.addEventListener('resize', () => renderer.resize());

  const frame = (): void => {
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error('Hardpoint failed to start', error);
});
