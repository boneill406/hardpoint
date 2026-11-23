import { describe, expect, it } from 'vitest';
import { PathFollower, type FollowStep } from '../../../src/sim/ai/PathFollower';
import type { ArenaDef } from '../../../src/sim/arena/ArenaDef';
import { Rng } from '../../../src/sim/core/Rng';
import { Simulation } from '../../../src/sim/core/Simulation';
import type { Transform } from '../../../src/sim/core/Transform';
import { Vec2 } from '../../../src/sim/core/Vec2';
import { TICK_SECONDS } from '../../../src/sim/core/time';
import { INSURGENT_AI } from '../../../src/sim/defs/ai';
import { SLICE_ARENA } from '../../../src/sim/defs/arenas';
import { INSURGENT_TANK } from '../../../src/sim/defs/vehicles';
import { RapierPhysicsWorld } from '../../../src/sim/physics/RapierPhysicsWorld';
import type {
  Controller,
  ControllerContext,
} from '../../../src/sim/vehicles/controllers/Controller';
import { IDLE_COMMAND, type VehicleCommand } from '../../../src/sim/vehicles/VehicleCommand';
import { Vehicle } from '../../../src/sim/vehicles/Vehicle';
import { createVehicle } from '../../../src/sim/vehicles/VehicleFactory';
import { seconds } from '../physics/overlap';

// M4-4a against real Rapier and the insurgent's real locomotion: a test
// controller plans with `world.findPath` and drives with `PathFollower`.

/** Plans once (or uses `firstPath`), replans when the follower asks, and logs every status. */
class GoTo implements Controller {
  readonly statuses: FollowStep['status'][] = [];
  private readonly follower = new PathFollower(INSURGENT_AI.driving, TICK_SECONDS);
  private planned = false;

  constructor(
    private readonly goal: Vec2,
    private readonly firstPath?: Vec2[],
  ) {}

  decide({ vehicle, world }: ControllerContext): VehicleCommand {
    const { position } = vehicle.transform;
    if (!this.planned) {
      this.follower.setPath(this.firstPath ?? this.plan(world, position), position, false);
      this.planned = true;
    }
    const step = this.follower.update(vehicle.transform);
    this.statuses.push(step.status);
    if (step.status === 'replan') {
      this.follower.setPath(this.plan(world, position), position, true);
    }
    // Turret along the path, as the AI does when it has nothing to shoot at.
    const aim = step.toward === undefined ? {} : { aimPoint: step.toward };
    return { ...IDLE_COMMAND, throttle: step.throttle, turn: step.turn, ...aim };
  }

  private plan(world: ControllerContext['world'], from: Vec2): readonly Vec2[] {
    return world.findPath(from, this.goal) ?? [];
  }
}

async function drive(
  arena: ArenaDef,
  start: Transform,
  controller: GoTo,
  duration: number,
): Promise<{ tank: Vehicle; simulation: Simulation; ticksToArrive: number | undefined }> {
  const simulation = new Simulation({
    seed: 1,
    physics: await RapierPhysicsWorld.create(),
    arena,
    populate: (sim) => {
      sim.world.add(
        createVehicle(INSURGENT_TANK, { transform: start, faction: 'insurgent', controller }),
      );
    },
  });
  const [tank] = simulation.world.ofType(Vehicle);
  if (tank === undefined) throw new Error('setup');
  let ticksToArrive: number | undefined;
  for (let i = 0; i < seconds(duration); i++) {
    simulation.tick(new Map());
    if (ticksToArrive === undefined && controller.statuses.at(-1) === 'arrived') {
      ticksToArrive = i;
    }
  }
  return { tank, simulation, ticksToArrive };
}

describe('driving a path (real Rapier, insurgent locomotion)', () => {
  it('crosses the slice arena around the centre pillar and stops at the goal, never stuck', async () => {
    // From below the centre pillar (0, 2; 3 × 3) to above it: the straight line is blocked.
    const goal = new Vec2(0, 9);
    const controller = new GoTo(goal);
    const start = { position: new Vec2(0, -2.5), heading: 0 };
    const { tank, simulation, ticksToArrive } = await drive(SLICE_ARENA, start, controller, 12);
    expect(ticksToArrive).toBeDefined();
    expect(tank.transform.position.distanceTo(goal)).toBeLessThan(
      INSURGENT_AI.driving.arriveRadius + 0.3,
    );
    expect(controller.statuses).not.toContain('unsticking');
    expect(tank.linearVelocity.length()).toBeLessThan(0.2);
    simulation.dispose();
  });

  it('starting facing away, it pivots first, then drives', async () => {
    const goal = new Vec2(0, 10);
    const controller = new GoTo(goal);
    const start = { position: new Vec2(0, -10), heading: Math.PI };
    const room = { ...SLICE_ARENA, pillars: [], crates: [] };
    const { ticksToArrive, simulation } = await drive(room, start, controller, 10);
    // 20 u at 4 u/s plus a half-turn at 1.4 rad/s ≈ 5 + 2.2 s.
    expect(ticksToArrive).toBeDefined();
    expect((ticksToArrive ?? 0) / 60).toBeLessThan(8.5);
    simulation.dispose();
  });

  it('pushing into a pillar (a bad path), it backs off, replans around it and arrives', async () => {
    const pillar = { center: new Vec2(0, 0), width: 3, depth: 3 };
    const room: ArenaDef = { ...SLICE_ARENA, pillars: [pillar], crates: [] };
    const goal = new Vec2(0, 8);
    // A hand-made path straight through the pillar: the tank rams it and gets stuck.
    const controller = new GoTo(goal, [goal]);
    const start = { position: new Vec2(0, -5), heading: 0 };
    const { tank, simulation, ticksToArrive } = await drive(room, start, controller, 15);
    expect(controller.statuses).toContain('unsticking');
    expect(controller.statuses).toContain('replan');
    expect(controller.statuses).not.toContain('gave-up');
    expect(ticksToArrive).toBeDefined();
    expect(tank.transform.position.distanceTo(goal)).toBeLessThan(1);
    simulation.dispose();
  });

  it('20 trips between random open points of the slice arena all arrive: never stuck for good', async () => {
    // Fixed seed, so the same 20 trips every run. Random start headings include
    // starts right against cover, which need a back-off or two.
    const rng = new Rng(7);
    const failures: string[] = [];
    for (let trip = 0; trip < 20; trip++) {
      const probe = new Simulation({
        seed: 1,
        physics: await RapierPhysicsWorld.create(),
        arena: SLICE_ARENA,
      });
      const grid = probe.navGrid;
      probe.dispose();
      const pick = (): Vec2 => {
        for (;;) {
          const point = new Vec2(rng.range(-21, 21), rng.range(-21, 21));
          if (grid?.isOpenAt(point) === true) return point;
        }
      };
      const start = { position: pick(), heading: 0 };
      const goal = pick();
      const startHeading = rng.range(-Math.PI, Math.PI);
      const controller = new GoTo(goal);
      const { ticksToArrive, simulation } = await drive(
        SLICE_ARENA,
        { ...start, heading: startHeading },
        controller,
        25,
      );
      if (ticksToArrive === undefined || controller.statuses.includes('gave-up')) {
        const from = start.position;
        failures.push(`trip ${trip}: (${from.x}, ${from.z}) → (${goal.x}, ${goal.z})`);
      }
      simulation.dispose();
    }
    expect(failures).toEqual([]);
  }, 60_000);
});
