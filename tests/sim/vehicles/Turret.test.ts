import { describe, expect, it } from 'vitest';
import { degToRad } from '../../../src/sim/core/angles';
import { Simulation } from '../../../src/sim/core/Simulation';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { Turret } from '../../../src/sim/vehicles/Turret';
import type { TurretDef } from '../../../src/sim/vehicles/VehicleDef';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { FakePhysicsWorld } from '../physics/FakePhysicsWorld';
import { scriptedTank } from './testVehicles';
import { IDLE_COMMAND } from '../../../src/sim/vehicles/VehicleCommand';

/** 4 rad/s, 3-tick spin-up, 1° snap, 1.2 u minimum aim distance (the player's values). */
const DEF: TurretDef = {
  traverseRate: 4,
  spinUpTime: 0.05,
  snapAngle: degToRad(1),
  minAimDistance: 1.2,
};
const ORIGIN = Vec2.ZERO;

/** An aim point 10 u from the origin along `heading`. */
function aimAt(heading: number): Vec2 {
  return Vec2.fromHeading(heading).scale(10);
}

function run(turret: Turret, aim: Vec2 | undefined, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    turret.saveHeading();
    turret.step(aim, ORIGIN, TICK_SECONDS);
  }
}

describe('Turret', () => {
  it('starts facing the hull heading and holds it with no aim', () => {
    const turret = new Turret(DEF, 0.7);
    run(turret, undefined, 60);
    expect(turret.heading).toBe(0.7);
  });

  it('waits the spin-up time (3 ticks) before it starts to traverse', () => {
    const turret = new Turret(DEF, 0);
    run(turret, aimAt(Math.PI / 2), 2);
    expect(turret.heading).toBe(0);
    run(turret, aimAt(Math.PI / 2), 1);
    expect(turret.heading).toBeCloseTo(4 / 60, 12);
  });

  it('traverses at its rate: a quarter turn takes spin-up plus π/2 ÷ 4 rad/s', () => {
    const turret = new Turret(DEF, 0);
    const ticksToTurn = Math.ceil(Math.PI / 2 / (4 / 60));
    run(turret, aimAt(Math.PI / 2), 2 + ticksToTurn - 1);
    expect(turret.heading).toBeLessThan(Math.PI / 2);
    run(turret, aimAt(Math.PI / 2), 1);
    expect(turret.heading).toBeCloseTo(Math.PI / 2, 12);
  });

  it('snaps straight onto an aim within 1°, with no spin-up', () => {
    const turret = new Turret(DEF, 0);
    run(turret, aimAt(degToRad(0.8)), 1);
    expect(turret.heading).toBeCloseTo(degToRad(0.8), 12);
  });

  it('takes the short way round across ±180°', () => {
    const turret = new Turret(DEF, degToRad(170));
    run(turret, aimAt(degToRad(-170)), 4);
    // Turning +4/60 rad per tick from 170° crosses 180°, rather than sweeping back through 0°.
    expect(Math.abs(turret.heading)).toBeGreaterThan(degToRad(170));
  });

  it('ignores aim points closer than the minimum distance and keeps its last target', () => {
    const turret = new Turret(DEF, 0);
    run(turret, new Vec2(1, 0), 60);
    expect(turret.heading).toBe(0);
  });

  it('keeps traversing to its target once moving, and spins up again for the next aim', () => {
    const turret = new Turret(DEF, 0);
    run(turret, aimAt(1), 40);
    expect(turret.heading).toBeCloseTo(1, 12);
    run(turret, aimAt(-1), 2);
    expect(turret.heading).toBeCloseTo(1, 12);
  });

  it('keeps last tick’s heading for interpolation', () => {
    const turret = new Turret(DEF, 0);
    run(turret, aimAt(1), 10);
    const before = turret.heading;
    run(turret, aimAt(1), 1);
    expect(turret.previousHeading).toBe(before);
  });
});

describe('Turret on a vehicle', () => {
  it('is stabilised: pivoting the hull does not swing the turret off its aim', () => {
    const aim = new Vec2(0, 20);
    const simulation = new Simulation({
      seed: 1,
      physics: new FakePhysicsWorld(),
      populate: (sim) => {
        sim.world.add(scriptedTank({ ...IDLE_COMMAND, turn: 1, aimPoint: aim }));
      },
    });
    const [tank] = simulation.world.ofType(Vehicle);
    for (let i = 0; i < 60; i++) {
      simulation.tick(new Map());
    }
    expect(Math.abs(tank?.transform.heading ?? 0)).toBeGreaterThan(1);
    expect(tank?.turret.heading).toBeCloseTo(0, 12);
  });

  it('turns toward the command’s aim point', () => {
    const simulation = new Simulation({
      seed: 1,
      physics: new FakePhysicsWorld(),
      populate: (sim) => {
        sim.world.add(scriptedTank({ ...IDLE_COMMAND, aimPoint: new Vec2(20, 0) }));
      },
    });
    const [tank] = simulation.world.ofType(Vehicle);
    for (let i = 0; i < 60; i++) {
      simulation.tick(new Map());
    }
    expect(tank?.turret.heading).toBeCloseTo(Math.PI / 2, 12);
  });
});
