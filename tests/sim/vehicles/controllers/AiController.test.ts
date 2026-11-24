import { describe, expect, it } from 'vitest';
import { angleDelta, degToRad } from '../../../../src/sim/core/angles';
import { Vec2 } from '../../../../src/sim/core/Vec2';
import { INSURGENT_AI } from '../../../../src/sim/defs/ai';
import { AiController } from '../../../../src/sim/vehicles/controllers/AiController';
import { IDLE_COMMAND, type VehicleCommand } from '../../../../src/sim/vehicles/VehicleCommand';
import { FakeWorld, fakeVehicle, type FakeVehicle } from '../../ai/fakeWorld';

const ENGAGE = INSURGENT_AI.engage;

interface Scene {
  readonly world: FakeWorld;
  readonly ai: AiController;
  readonly me: FakeVehicle;
  readonly player: FakeVehicle;
  tick: number;
  decide(): VehicleCommand;
}

/** An insurgent at `from` and the player at the origin, facing +z. */
function scene(from = new Vec2(0, 15)): Scene {
  const world = new FakeWorld();
  const player = world.add(fakeVehicle(1, 'player', Vec2.ZERO));
  const me = world.add(fakeVehicle(2, 'insurgent', from, Math.PI));
  const ai = new AiController(INSURGENT_AI);
  const s: Scene = {
    world,
    ai,
    me,
    player,
    tick: 0,
    decide: () => ai.decide({ tick: s.tick++, commands: new Map(), vehicle: me, world }),
  };
  return s;
}

/** Puts the tank on its chosen spot, facing the target, turret on target, and lets it notice. */
function arriveAndEngage(s: Scene): void {
  s.decide();
  const spot = s.ai.debug.spot;
  if (spot === undefined) throw new Error('no spot');
  const facing = s.player.transform.position.sub(spot).heading();
  s.me.transform = { position: spot, heading: facing };
  s.me.turret.heading = facing;
  s.decide();
}

describe('AiController: Advance', () => {
  it('picks a firing spot on the rings with sight of the player, and drives toward it', () => {
    const s = scene();
    const command = s.decide();
    const spot = s.ai.debug.spot;
    expect(s.ai.debug.state).toBe('advance');
    expect(spot).toBeDefined();
    const range = spot?.distanceTo(s.player.transform.position) ?? 0;
    expect(ENGAGE.rings.some((ring) => Math.abs(ring - range) < 1e-9)).toBe(true);
    // Facing the spot already (heading π, spot below it): drive, gun along the path.
    expect(command.throttle).toBeGreaterThan(0);
    expect(command.firePrimary).toBe(false);
    expect(command.aimPoint).toBeDefined();
  });

  it('the nearest spot wins: from straight above, the 12 u spot straight above the player', () => {
    const s = scene(new Vec2(0, 15));
    s.decide();
    expect(s.ai.debug.spot?.x).toBeCloseTo(0, 9);
    expect(s.ai.debug.spot?.z).toBeCloseTo(12, 9);
  });

  it('on reaching the spot with sight of the player, it engages', () => {
    const s = scene();
    arriveAndEngage(s);
    expect(s.ai.debug.state).toBe('engage');
  });

  it('on reaching the spot without sight, it repositions instead', () => {
    const s = scene();
    s.decide();
    const spot = s.ai.debug.spot;
    if (spot === undefined) throw new Error('no spot');
    s.me.transform = { position: spot, heading: Math.PI };
    s.world.sight = (from) => from.distanceTo(spot) > 0.5; // blind from exactly here
    s.decide();
    expect(s.ai.debug.state).toBe('reposition');
  });

  it('with nobody to fight it idles', () => {
    const s = scene();
    s.player.health.depleted = true;
    expect(s.decide()).toEqual(IDLE_COMMAND);
    expect(s.ai.debug.state).toBe('idle');
  });
});

describe('AiController: Engage', () => {
  it('stops, and turns its hull until the player is within 15° of the nose', () => {
    const s = scene();
    arriveAndEngage(s);
    // Hull turned 40° away from the player: it turns back (sign toward the player).
    const facing = s.me.transform.heading;
    s.me.transform = { ...s.me.transform, heading: facing + degToRad(40) };
    const turning = s.decide();
    expect(turning.throttle).toBe(0);
    expect(Math.sign(turning.turn)).toBe(Math.sign(angleDelta(s.me.transform.heading, facing)));
    s.me.transform = { ...s.me.transform, heading: facing + degToRad(10) };
    expect(s.decide().turn).toBe(0);
  });

  it('fires only when the turret is on target and the player is in sight', () => {
    const s = scene();
    arriveAndEngage(s);
    const onTarget = s.me.turret.heading;
    s.me.turret.heading = onTarget + degToRad(5);
    expect(s.decide().firePrimary).toBe(false);
    s.me.turret.heading = onTarget;
    expect(s.decide().firePrimary).toBe(true);
    s.world.sight = () => false;
    expect(s.decide().firePrimary).toBe(false);
  });

  it('once holding the trigger, keeps holding through small aim drift (up to 3 × 2°), so a windup survives tracking', () => {
    const s = scene();
    arriveAndEngage(s);
    const onTarget = s.me.turret.heading;
    expect(s.decide().firePrimary).toBe(true);
    s.me.turret.heading = onTarget + degToRad(5);
    expect(s.decide().firePrimary).toBe(true);
    s.me.turret.heading = onTarget + degToRad(7);
    expect(s.decide().firePrimary).toBe(false);
    // Not holding any more: back to the strict 2° to start again.
    s.me.turret.heading = onTarget + degToRad(5);
    expect(s.decide().firePrimary).toBe(false);
  });

  it('holds fire while an ally is in the line of fire, and fires once it moves out (M4-6)', () => {
    const s = scene();
    arriveAndEngage(s);
    const midway = s.me.transform.position.lerp(s.player.transform.position, 0.5);
    const ally = s.world.add(fakeVehicle(3, 'insurgent', midway));
    expect(s.decide().firePrimary).toBe(false);
    expect(s.ai.debug.allyInLine).toBe(true);
    ally.transform = { ...ally.transform, position: midway.add(new Vec2(5, 0)) };
    expect(s.decide().firePrimary).toBe(true);
    expect(s.ai.debug.allyInLine).toBe(false);
  });

  it('an ally driving into the line mid-windup makes it release the trigger (cancelling the shot)', () => {
    const s = scene();
    arriveAndEngage(s);
    expect(s.decide().firePrimary).toBe(true);
    const midway = s.me.transform.position.lerp(s.player.transform.position, 0.5);
    s.world.add(fakeVehicle(3, 'insurgent', midway));
    expect(s.decide().firePrimary).toBe(false);
  });

  it('an ally beyond the player, or a vehicle of another side in between, does not stop it firing', () => {
    const s = scene();
    arriveAndEngage(s);
    const toPlayer = s.player.transform.position.sub(s.me.transform.position);
    s.world.add(fakeVehicle(3, 'insurgent', s.player.transform.position.add(toPlayer.scale(0.5))));
    expect(s.decide().firePrimary).toBe(true);
    s.world.add(fakeVehicle(4, 'player', s.me.transform.position.add(toPlayer.scale(0.5))));
    expect(s.decide().firePrimary).toBe(true);
  });

  it('an ally just off the line still counts: the check is as wide as the spread, not a thin ray', () => {
    const s = scene();
    arriveAndEngage(s);
    const midway = s.me.transform.position.lerp(s.player.transform.position, 0.5);
    const across = Vec2.fromHeading(s.me.turret.heading + Math.PI / 2);
    // Fake hulls are 1 u discs: 1.2 u off the line misses a thin ray but not the 0.3 u check.
    s.world.add(fakeVehicle(3, 'insurgent', midway.add(across.scale(1.2))));
    expect(s.decide().firePrimary).toBe(false);
  });

  it('aims at the player (no lead in the slice)', () => {
    const s = scene();
    arriveAndEngage(s);
    s.player.linearVelocity = new Vec2(5, 0);
    expect(s.decide().aimPoint).toEqual(s.player.transform.position);
  });

  it('after 1.5 s without sight, it repositions to a new spot at least 3 u away', () => {
    const s = scene();
    arriveAndEngage(s);
    const engagedAt = s.me.transform.position;
    // Blind from where it stands; every other spot can still see.
    s.world.sight = (from) => from.distanceTo(engagedAt) > 0.5;
    const lostTicks = ENGAGE.lostSightTime * 60;
    for (let i = 0; i < lostTicks - 1; i++) {
      s.decide();
      expect(s.ai.debug.state).toBe('engage');
    }
    s.decide();
    expect(s.ai.debug.state).toBe('reposition');
    s.decide();
    expect(s.ai.debug.state).toBe('advance');
    expect(s.ai.debug.spot?.distanceTo(engagedAt)).toBeGreaterThanOrEqual(ENGAGE.minMove);
  });

  it('when the player gets behind it within 8 u, it repositions rather than turning its rear to them', () => {
    const s = scene();
    arriveAndEngage(s);
    const { position, heading } = s.me.transform;
    s.player.transform = {
      position: position.add(Vec2.fromHeading(heading + Math.PI).scale(5)),
      heading: 0,
    };
    s.decide();
    expect(s.ai.debug.state).toBe('reposition');
  });

  it('when the player drives out of range, it repositions to close in', () => {
    const s = scene();
    arriveAndEngage(s);
    s.player.transform = { position: new Vec2(0, -19), heading: 0 };
    s.decide();
    expect(s.ai.debug.state).toBe('reposition');
  });
});
