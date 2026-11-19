import { describe, expect, it } from 'vitest';

// Sample test for M0-5. Real simulation tests start in M1; this one guards the
// test setup itself: simulation tests must run without any browser globals.
describe('simulation test environment', () => {
  it('runs in Node without browser globals', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
