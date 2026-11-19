import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Simulation tests run in plain Node: no DOM, mirroring the sim's own rules.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
