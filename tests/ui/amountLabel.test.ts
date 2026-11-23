import { describe, expect, it } from 'vitest';
import { amountLabel } from '../../src/ui/amountLabel';

describe('amountLabel', () => {
  it('shows whole numbers plain and fractions to one decimal', () => {
    expect(amountLabel(32.5)).toBe('32.5');
    expect(amountLabel(50)).toBe('50');
    expect(amountLabel(3)).toBe('3');
  });

  it('rounds float noise away instead of showing a trailing .0', () => {
    expect(amountLabel(100 - 7.8 - 7.8)).toBe('84.4');
    expect(amountLabel(24.999999)).toBe('25');
    expect(amountLabel(0.04)).toBe('0');
  });
});
