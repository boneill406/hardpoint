import { describe, expect, it } from 'vitest';
import { PlayerController } from '../../../../src/sim/vehicles/controllers/PlayerController';
import { IDLE_COMMAND } from '../../../../src/sim/vehicles/VehicleCommand';
import { drive, scriptedTank } from '../testVehicles';

const vehicle = scriptedTank(IDLE_COMMAND);

describe('PlayerController', () => {
  it("returns its own player's command", () => {
    const mine = drive(1, 0.5);
    const commands = new Map([
      [1, mine],
      [2, drive(-1)],
    ]);
    expect(new PlayerController(1).decide({ tick: 0, commands, vehicle })).toBe(mine);
  });

  it('a missing command means idle, not the previous command', () => {
    const controller = new PlayerController(1);
    controller.decide({ tick: 0, commands: new Map([[1, drive(1)]]), vehicle });
    expect(controller.decide({ tick: 1, commands: new Map(), vehicle })).toBe(IDLE_COMMAND);
  });
});
