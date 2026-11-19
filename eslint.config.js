// ESLint flat config for Hardpoint.
//
// The most important part is the "simulation boundary" block: it is how CI
// enforces ADR-0001 (determinism) and ADR-0003 (sim decoupled from rendering).
// Never disable or weaken it; see CLAUDE.md "Hard architecture rules".

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** Rule selectors shared by every TS file. Repeated in the sim block because
 *  a later `no-restricted-syntax` config replaces (not merges) earlier ones. */
const noDefaultExport = {
  selector: 'ExportDefaultDeclaration',
  message: 'Use named exports (CLAUDE.md code conventions).',
};

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Type-aware linting for all TypeScript files.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': ['error', noDefaultExport],
    },
  },

  // Tool config files must use a default export.
  {
    files: ['*.config.ts', '*.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Plain JS (this file) is not part of the TS project: skip type-aware rules.
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  // ---------------------------------------------------------------------------
  // Simulation boundary (ADR-0001, ADR-0003). src/sim must stay pure TypeScript.
  // ---------------------------------------------------------------------------
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@babylonjs/*'],
              message: 'src/sim must not import Babylon (ADR-0003).',
            },
            {
              regex: '(^|/)(render|input|ui|app)(/|$)',
              message: 'src/sim must not import render/, input/, ui/ or app/ (ADR-0003).',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the simulation Rng (ADR-0001).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Use the tick count, not wall-clock time (ADR-0001).',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Use the tick count, not wall-clock time (ADR-0001).',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'performance',
          'localStorage',
          'requestAnimationFrame',
          'setTimeout',
          'setInterval',
        ].map((name) => ({
          name,
          message: 'src/sim must not use browser APIs or real timers (ADR-0001, ADR-0003).',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        noDefaultExport,
        {
          selector: "NewExpression[callee.name='Date'], CallExpression[callee.name='Date']",
          message: 'Use the tick count, not wall-clock time (ADR-0001).',
        },
      ],
    },
  },

  // Must be last: turns off stylistic rules that conflict with Prettier.
  prettier,
);
