import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Simulation tests run in plain Node: no DOM, mirroring the sim's own rules.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Watch mode only reruns tests whose imports changed. tests/tooling/ reads
    // eslint.config.js through ESLint at runtime (not via an import), so list it here.
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, '**/eslint.config.js'],
  },
});
