import { describe, expect, it } from 'vitest';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { IDLE_COMMAND } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import type { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { drive, scriptedTank, TEST_TANK } from './testVehicles';

/** Runs the vehicle's own tick phases (no Simulation) with a fixed command. */
function tickVehicle(vehicle: Vehicle, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    vehicle.saveTransform();
    vehicle.drive(TICK_SECONDS);
    vehicle.integrate(TICK_SECONDS);
  }
}

describe('Vehicle', () => {
  it('starts idle and at rest', () => {
    const tank = scriptedTank(drive(1));
    expect(tank.command).toBe(IDLE_COMMAND);
    expect(tank.linearVelocity.length()).toBe(0);
    expect(tank.angularVelocity).toBe(0);
  });

  it('moves along its heading at full throttle', () => {
    const tank = scriptedTank(drive(1), { position: Vec2.ZERO, heading: Math.PI / 2 });
    tank.applyCommand(drive(1));
    tickVehicle(tank, 60);
    // 0.5 s ramping up (2.5 u) + 0.5 s at 10 u/s (5 u) ≈ 7.5 u along +x, nudged by tick rounding.
    expect(tank.transform.position.x).toBeCloseTo(7.5, 0);
    expect(tank.transform.position.z).toBeCloseTo(0, 9);
  });

  it('keeps its heading wrapped while turning', () => {
    const tank = scriptedTank(drive(0, 1), { position: Vec2.ZERO, heading: 3 });
    tank.applyCommand(drive(0, 1));
    tickVehicle(tank, 30);
    expect(tank.transform.heading).toBeGreaterThanOrEqual(-Math.PI);
    expect(tank.transform.heading).toBeLessThan(0);
  });

  it('snapshot adds velocities to the transform', () => {
    const tank = scriptedTank(drive(1));
    tank.assignId(1);
    tank.applyCommand(drive(1));
    tickVehicle(tank, 10);
    expect(tank.snapshot()).toEqual({
      id: 1,
      x: tank.transform.position.x,
      z: tank.transform.position.z,
      heading: tank.transform.heading,
      vx: tank.linearVelocity.x,
      vz: tank.linearVelocity.z,
      angularVelocity: 0,
      locomotion: { gear: 1, shiftElapsed: 0 },
    });
  });
});

describe('createVehicle', () => {
  it('builds a vehicle with the given def, faction, controller and transform', () => {
    const controller = new ScriptedController(() => IDLE_COMMAND);
    const transform = { position: new Vec2(3, 4), heading: 1 };
    const tank = createVehicle(TEST_TANK, { transform, faction: 'insurgent', controller });

    expect(tank.def).toBe(TEST_TANK);
    expect(tank.faction).toBe('insurgent');
    expect(tank.controller).toBe(controller);
    expect(tank.transform).toBe(transform);
  });

  it("drives with the def's tracked locomotion numbers", () => {
    const tank = scriptedTank(drive(1));
    tank.applyCommand(drive(1));
    tickVehicle(tank, 120);
    expect(tank.linearVelocity.length()).toBeCloseTo(TEST_TANK.locomotion.topSpeed, 9);
  });
});
