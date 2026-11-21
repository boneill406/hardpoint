import { describe, expect, it } from 'vitest';
import { FireLatch } from '../../src/input/FireLatch';
import { IDLE_COMMAND, type VehicleCommand } from '../../src/sim/vehicles/VehicleCommand';

const PRESS: VehicleCommand = { ...IDLE_COMMAND, firePrimary: true };

describe('FireLatch', () => {
  it('passes a held trigger straight through', () => {
    const latch = new FireLatch();
    expect(latch.apply(PRESS).firePrimary).toBe(true);
    latch.consumed();
    expect(latch.apply(PRESS).firePrimary).toBe(true);
  });

  it('keeps a press made on a frame with no tick until a tick has run', () => {
    const latch = new FireLatch();
    latch.apply(PRESS); // frame with zero ticks: not consumed
    const nextFrame = latch.apply(IDLE_COMMAND); // already released
    expect(nextFrame.firePrimary).toBe(true);
    latch.consumed();
    expect(latch.apply(IDLE_COMMAND).firePrimary).toBe(false);
  });

  it('latches the two triggers independently and leaves the rest of the command alone', () => {
    const latch = new FireLatch();
    latch.apply({ ...IDLE_COMMAND, fireSecondary: true, throttle: 1 });
    const next = latch.apply({ ...IDLE_COMMAND, throttle: 0.5 });
    expect(next).toEqual({ ...IDLE_COMMAND, throttle: 0.5, fireSecondary: true });
  });
});
