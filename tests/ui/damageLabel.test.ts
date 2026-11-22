import { describe, expect, it } from 'vitest';
import { damageLabel } from '../../src/ui/HealthOverlay';

describe('damageLabel', () => {
  it('shows whole numbers plain and fractions to one decimal', () => {
    expect(damageLabel(32.5)).toBe('32.5');
    expect(damageLabel(50)).toBe('50');
    expect(damageLabel(3)).toBe('3');
  });
});
