import { describe, expect, it } from 'vitest';
import type { ControllerContext } from '../../../../src/sim/vehicles/controllers/Controller';
import { PlayerController } from '../../../../src/sim/vehicles/controllers/PlayerController';
import { IDLE_COMMAND } from '../../../../src/sim/vehicles/VehicleCommand';
import { EMPTY_WORLD } from '../../core/emptyWorld';
import { drive, scriptedTank } from '../testVehicles';

const vehicle = scriptedTank(IDLE_COMMAND);

describe('PlayerController', () => {
  it("returns its own player's command", () => {
    const mine = drive(1, 0.5);
    const commands = new Map([
      [1, mine],
      [2, drive(-1)],
    ]);
    expect(new PlayerController(1).decide({ tick: 0, commands, vehicle, world: EMPTY_WORLD })).toBe(
      mine,
    );
  });

  it('the context gives a read-only vehicle: mutating calls do not compile (M4 plan D1)', () => {
    const decideAndMutate = (context: ControllerContext): void => {
      // @ts-expect-error: VehicleView has no applyCommand
      context.vehicle.applyCommand(IDLE_COMMAND);
      // @ts-expect-error: health is read-only (no damage)
      context.vehicle.health.damage(10);
    };
    expect(typeof decideAndMutate).toBe('function');
  });

  it('a missing command means idle, not the previous command', () => {
    const controller = new PlayerController(1);
    controller.decide({ tick: 0, commands: new Map([[1, drive(1)]]), vehicle, world: EMPTY_WORLD });
    expect(controller.decide({ tick: 1, commands: new Map(), vehicle, world: EMPTY_WORLD })).toBe(
      IDLE_COMMAND,
    );
  });
});
