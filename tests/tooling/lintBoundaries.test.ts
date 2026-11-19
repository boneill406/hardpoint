import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Guards the simulation-boundary lint rules (ADR-0001, ADR-0003). If someone
// weakens eslint.config.js, these tests fail in CI.

const BOUNDARY_RULES = [
  'no-restricted-imports',
  'no-restricted-properties',
  'no-restricted-globals',
  'no-restricted-syntax',
];

// The snippets are linted as if they lived at these (non-existent) paths. Type-aware
// parsing needs real files, so it is switched off and only boundary rules run.
const eslint = new ESLint({
  overrideConfig: { languageOptions: { parserOptions: { projectService: false } } },
  ruleFilter: ({ ruleId }) => BOUNDARY_RULES.includes(ruleId),
});

async function ruleIdsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

const SIM_FILE = 'src/sim/core/Fixture.ts';
const RENDER_FILE = 'src/render/Fixture.ts';

const violations: ReadonlyArray<{ name: string; code: string; rule: string }> = [
  {
    name: 'importing Babylon',
    code: "import { Scene } from '@babylonjs/core';\nexport const s = Scene;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'type-importing Babylon',
    code: "import type { Scene } from '@babylonjs/core';\nexport type S = Scene;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'importing from render/',
    code: "import { View } from '../../render/View';\nexport const v = View;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'importing from input/',
    code: "import { Pad } from '../../input/Pad';\nexport const p = Pad;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'importing from ui/',
    code: "import { Hud } from '../../ui/Hud';\nexport const h = Hud;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'importing from app/',
    code: "import { main } from '../../app/main';\nexport const m = main;",
    rule: 'no-restricted-imports',
  },
  {
    name: 'calling Math.random',
    code: 'export const r = Math.random();',
    rule: 'no-restricted-properties',
  },
  {
    name: 'calling Date.now',
    code: 'export const t = Date.now();',
    rule: 'no-restricted-properties',
  },
  {
    name: 'constructing a Date',
    code: 'export const d = new Date();',
    rule: 'no-restricted-syntax',
  },
  {
    name: 'reading window',
    code: 'export const w = window.innerWidth;',
    rule: 'no-restricted-globals',
  },
  {
    name: 'using setTimeout',
    code: 'setTimeout(() => undefined, 10);',
    rule: 'no-restricted-globals',
  },
];

describe('simulation boundary lint rules', () => {
  it.each(violations)('rejects $name in src/sim', async ({ code, rule }) => {
    expect(await ruleIdsFor(code, SIM_FILE)).toContain(rule);
  });

  it.each(violations)('allows $name outside src/sim', async ({ code }) => {
    expect(await ruleIdsFor(code, RENDER_FILE)).toEqual([]);
  });

  it('allows sim code to import Rapier and sibling sim modules', async () => {
    const code = [
      "import RAPIER from '@dimforge/rapier2d-compat';",
      "import { Rng } from '../core/Rng';",
      'export const deps = [RAPIER, Rng];',
    ].join('\n');
    expect(await ruleIdsFor(code, SIM_FILE)).toEqual([]);
  });

  it('rejects default exports everywhere', async () => {
    const code = 'export default 1;';
    expect(await ruleIdsFor(code, SIM_FILE)).toContain('no-restricted-syntax');
    expect(await ruleIdsFor(code, RENDER_FILE)).toContain('no-restricted-syntax');
  });
});
