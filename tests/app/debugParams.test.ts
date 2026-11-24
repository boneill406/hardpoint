import { describe, expect, it } from 'vitest';
import { readDebugParams } from '../../src/app/debugParams';

describe('readDebugParams', () => {
  it('reads valid parameters with no warnings', () => {
    const params = readDebugParams(
      '?fps=20&interp=off&pad=direct&grid=on&cam=proto&armor=struck&hp=off&enemies=3&dummies=on&ai=on&nav=on&mode=sandbox&wave=4',
    );
    expect(params).toEqual({
      fps: 20,
      interpolate: false,
      pad: 'direct',
      grid: true,
      cam: 'proto',
      armor: 'struck',
      hp: false,
      mode: 'sandbox',
      wave: 4,
      enemies: 3,
      dummies: true,
      ai: true,
      nav: true,
      warnings: [],
    });
  });

  it('defaults everything when there is no query string (pad: triggers, camera: slice, hp: on)', () => {
    expect(readDebugParams('')).toEqual({
      fps: undefined,
      interpolate: true,
      pad: 'triggers',
      grid: false,
      cam: 'slice',
      armor: undefined,
      hp: true,
      mode: 'waves',
      wave: 1,
      enemies: 1,
      dummies: false,
      ai: false,
      nav: false,
      warnings: [],
    });
  });

  it('warns about ? used instead of &, and falls back to the default', () => {
    const params = readDebugParams('?pad=triggers?grid=on');
    expect(params.pad).toBe('triggers');
    expect(params.grid).toBe(false);
    expect(params.warnings).toEqual([
      'Ignoring ?pad=triggers?grid=on: expected tank | direct | triggers (separate parameters with &, not ?)',
    ]);
  });

  it('warns about unknown names and invalid values', () => {
    const { warnings } = readDebugParams(
      '?fsp=20&fps=-3&grid=yes&pad=toString&armor=angle&enemies=4',
    );
    expect(warnings).toEqual([
      'Unknown debug parameter "fsp" (known: fps, interp, pad, grid, cam, armor, hp, enemies, dummies, ai, nav, mode, wave)',
      'Ignoring ?fps=-3: expected a positive number',
      'Ignoring ?pad=toString: expected tank | direct | triggers',
      'Ignoring ?armor=angle: expected direction | struck',
      'Ignoring ?enemies=4: expected a whole number 0–3',
      'Ignoring ?grid=yes: expected on | off',
    ]);
  });
});
