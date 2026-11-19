import { Renderer } from '../render/Renderer';
import { Simulation } from '../sim/core/Simulation';
import { RapierPhysicsWorld } from '../sim/physics/RapierPhysicsWorld';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop. M1-5: the simulation is created (and owns the physics
 * world); M1-6 adds the fixed-step loop and renders its entities.
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
  const simulation = new Simulation({ seed: 1, physics: await RapierPhysicsWorld.create() });
  simulation.tick(new Map());
  console.info(`Simulation ready: tick ${simulation.tickCount}, Rapier 2D physics`);

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
