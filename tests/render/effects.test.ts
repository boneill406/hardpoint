import { describe, expect, it } from 'vitest';
import { EFFECTS, impactEffects } from '../../src/render/vfx/effects';

describe('impact effects (M6-1a)', () => {
  it('a shell flashes; sparks off tanks, dust and grit off stone, dust and splinters off crates', () => {
    expect(impactEffects('metal', 'shell')).toEqual(['flash', 'sparks']);
    expect(impactEffects('stone', 'shell')).toEqual(['flash', 'dust', 'chips']);
    expect(impactEffects('wood', 'shell')).toEqual(['flash', 'woodDust', 'splinters']);
  });

  it('an MG round is a small version, with no flash', () => {
    expect(impactEffects('metal', 'tracer')).toEqual(['sparksSmall']);
    expect(impactEffects('stone', 'tracer')).toEqual(['dustSmall']);
  });
});

// Invariants any tuning must keep, not the values themselves.
describe.each(Object.entries(EFFECTS))('%s effect def', (_name, def) => {
  it('has sane ranges: min ≤ max, positive lifetimes and sizes, at least one particle', () => {
    expect(def.count).toBeGreaterThanOrEqual(1);
    expect(def.lifetime[0]).toBeGreaterThan(0);
    expect(def.lifetime[0]).toBeLessThanOrEqual(def.lifetime[1]);
    expect(def.size[0]).toBeGreaterThan(0);
    expect(def.size[0]).toBeLessThanOrEqual(def.size[1]);
    expect(def.speed[0]).toBeLessThanOrEqual(def.speed[1]);
    expect(def.growth).toBeGreaterThan(0);
  });

  it('fades out: fully transparent at the end of its life', () => {
    expect(def.colour.end[3]).toBe(0);
  });

  it('lives under a second and a half, so effects never linger over the action (plan D19)', () => {
    expect(def.lifetime[1]).toBeLessThanOrEqual(1.5);
  });
});

it('every effect named by an impact exists', () => {
  const names = (['metal', 'stone', 'wood'] as const).flatMap((surface) =>
    (['shell', 'tracer'] as const).flatMap((look) => impactEffects(surface, look)),
  );
  for (const name of names) {
    expect(EFFECTS[name]).toBeDefined();
  }
});
