import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Simulation tests run in plain Node: no DOM, mirroring the sim's own rules.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Real-physics runs (determinism, hunts, whole wave runs) take a few seconds each and
    // occasionally passed 5 s when the full suite ran in parallel (M6-2c). A hang still fails.
    testTimeout: 20_000,
    // Watch mode only reruns tests whose imports changed. tests/tooling/ reads
    // eslint.config.js through ESLint at runtime (not via an import), so list it here.
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, '**/eslint.config.js'],
  },
});
