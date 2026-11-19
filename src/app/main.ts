import { Renderer } from '../render/Renderer';

/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the frame loop. M0: rendering only; the fixed-step simulation joins in M1.
 */
function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
}

function start(): void {
  const renderer = new Renderer(getCanvas());
  window.addEventListener('resize', () => renderer.resize());

  const frame = (): void => {
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
