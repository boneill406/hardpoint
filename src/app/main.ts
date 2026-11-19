/**
 * Application entry point. Wires input, simulation and rendering together and
 * owns the main loop. For now it only locates the canvas; Babylon arrives in M0-3.
 */
function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game"> in index.html');
  }
  return canvas;
}

const canvas = getCanvas();
console.info(`Hardpoint booted: canvas ${canvas.clientWidth}x${canvas.clientHeight}`);
