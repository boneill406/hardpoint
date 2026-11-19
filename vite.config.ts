import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    // Babylon (~6.3 MB) + Rapier 2D with embedded WASM (~3.4 MB); ADR-0002 accepts a large bundle.
    // The limit sits just above today's size so unexpected growth still warns.
    chunkSizeWarningLimit: 10500,
  },
});
