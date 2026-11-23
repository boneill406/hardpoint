import { describe, expect, it } from 'vitest';
import { Weapon } from '../../../src/sim/combat/Weapon';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { SimEvents } from '../../../src/sim/core/SimEvents';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { ScriptedController } from '../../../src/sim/debug/ScriptedController';
import { INSURGENT_TANK } from '../../../src/sim/defs/vehicles';
import { CANNON, INSURGENT_CANNON } from '../../../src/sim/defs/weapons';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';

// M4-5: the windup limiter and the fire telegraph it drives.

const TICK = 1 / 60;

/** Holds the trigger for `ticks` and returns the tick of each shot and telegraph change. */
function hold(weapon: Weapon, ticks: number, held: (tick: number) => boolean = () => true) {
  const shots: number[] = [];
  const telegraphs: [number, string][] = [];
  for (let tick = 0; tick < ticks; tick++) {
    weapon.update(TICK, held(tick));
    if (held(tick) && weapon.tryFire()) shots.push(tick);
    const change = weapon.telegraph();
    if (change !== undefined) telegraphs.push([tick, change]);
  }
  return { shots, telegraphs };
}

describe('Weapon with a windup', () => {
  it('the windup comes after the reload, never during it: shots every 2.4 + 0.3 s', () => {
    const { shots } = hold(new Weapon(INSURGENT_CANNON), 400);
    expect(shots).toEqual([18, 18 + 144 + 18, 18 + 2 * (144 + 18)]);
  });

  it('a telegraph starts 18 ticks before each shot', () => {
    const { shots, telegraphs } = hold(new Weapon(INSURGENT_CANNON), 200);
    expect(telegraphs).toEqual([
      [0, 'started'],
      [162, 'started'],
    ]);
    expect(shots).toEqual([18, 180]);
  });

  it('releasing mid-windup cancels the telegraph and the shot', () => {
    const { shots, telegraphs } = hold(new Weapon(INSURGENT_CANNON), 40, (tick) => tick < 10);
    expect(shots).toEqual([]);
    expect(telegraphs).toEqual([
      [0, 'started'],
      [10, 'cancelled'],
    ]);
  });

  it("the player's cannon has no windup: it fires on the first held tick", () => {
    const { shots, telegraphs } = hold(new Weapon(CANNON), 10);
    expect(shots).toEqual([0]);
    expect(telegraphs).toEqual([]);
  });
});

describe('telegraph events (real Rapier)', () => {
  async function run(script: (tick: number) => VehicleCommand, ticks: number) {
    const simulation = new Simulation({
      seed: 1,
      physics: await RapierPhysicsWorld.create(),
      populate: (sim) => {
        sim.world.add(
          createVehicle(INSURGENT_TANK, {
            transform: { position: Vec2.ZERO, heading: 0 },
            faction: 'insurgent',
            controller: new ScriptedController(script),
          }),
        );
      },
    });
    const log: string[] = [];
    let tick = 0;
    const record = (name: string) => (): void => {
      log.push(`${tick} ${name}`);
    };
    simulation.events.on('ShotTelegraphed', record('telegraph'));
    simulation.events.on('TelegraphCancelled', record('cancelled'));
    simulation.events.on('ShotFired', record('shot'));
    let telegraph: SimEvents['ShotTelegraphed'] | undefined;
    simulation.events.on('ShotTelegraphed', (event) => {
      telegraph = event;
    });
    for (; tick < ticks; tick++) {
      simulation.tick(new Map());
      simulation.events.flush();
    }
    simulation.dispose();
    return { log, telegraph };
  }

  it('ShotTelegraphed (with its duration) precedes ShotFired by 0.3 s', async () => {
    const { log, telegraph } = await run(() => ({ ...IDLE_COMMAND, firePrimary: true }), 30);
    expect(log).toEqual(['0 telegraph', '18 shot']);
    expect(telegraph).toMatchObject({ shooter: 1, hardpoint: 'main', seconds: 0.3 });
  });

  it('TelegraphCancelled when the trigger is released, and no shot', async () => {
    const { log } = await run((tick) => ({ ...IDLE_COMMAND, firePrimary: tick < 5 }), 30);
    expect(log).toEqual(['0 telegraph', '5 cancelled']);
  });
});
