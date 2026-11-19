import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    // Babylon is ~6.3 MB minified (~1.4 MB gzip); ADR-0002 accepts a large bundle.
    // The limit sits just above today's size so unexpected growth still warns.
    chunkSizeWarningLimit: 7000,
  },
});
