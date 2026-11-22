import { describe, expect, it } from 'vitest';
import { hitLabel } from '../../src/ui/HealthOverlay';

describe('hitLabel', () => {
  it('shows the damage dealt and the face, one decimal only when needed', () => {
    expect(hitLabel({ damage: 32.5, face: 'front' })).toBe('−32.5 front');
    expect(hitLabel({ damage: 50, face: 'side' })).toBe('−50 side');
    expect(hitLabel({ damage: 3, face: 'rear' })).toBe('−3 rear');
  });
});
