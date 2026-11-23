import type { AiDef } from '../../ai/AiDef';
import { chooseFiringSpot } from '../../ai/FiringSpots';
import { PathFollower, type FollowStep } from '../../ai/PathFollower';
import { angleDelta } from '../../core/angles';
import { clamp } from '../../core/scalar';
import type { SimQueries } from '../../core/SimQueries';
import { TICK_SECONDS } from '../../core/time';
import type { Vec2 } from '../../core/Vec2';
import { IDLE_COMMAND, type VehicleCommand } from '../VehicleCommand';
import type { VehicleView } from '../VehicleView';
import type { Controller, ControllerContext } from './Controller';

/** GDD §5 behaviour states, plus `idle` when there is nobody to fight. */
export type AiState = 'advance' | 'engage' | 'reposition' | 'idle';

/** What the `?ai=on` view draws. Read-only; nothing in the sim reads it. */
export interface AiDebug {
  readonly state: AiState;
  readonly spot: Vec2 | undefined;
  readonly path: readonly Vec2[];
}

/**
 * Drives an enemy tank (architecture.md §4, M4 plan): Advance to a firing
 * spot, Engage from it, Reposition when that stops working. It only returns
 * a `VehicleCommand`, exactly like the player's controller, so it drives,
 * aims and fires under the same rules as the player.
 *
 * Deterministic: decisions depend only on the tick, the world and its own
 * state, never on wall-clock time or `Math.random()`.
 */
export class AiController implements Controller {
  private mode: AiState = 'advance';
  private spot: Vec2 | undefined;
  private readonly follower: PathFollower;
  private ticksWithoutSight = 0;
  /** Holding the trigger last tick (a windup may be running). */
  private holding = false;
  private needsSpot = true;

  constructor(private readonly def: AiDef) {
    this.follower = new PathFollower(def.driving, TICK_SECONDS);
  }

  get debug(): AiDebug {
    return { state: this.mode, spot: this.spot, path: this.follower.remaining };
  }

  decide({ tick, vehicle, world }: ControllerContext): VehicleCommand {
    const target = nearestHostile(world, vehicle);
    if (target === undefined) {
      this.mode = 'idle';
      return IDLE_COMMAND;
    }
    if (this.mode === 'idle') {
      this.mode = 'advance';
      this.needsSpot = true;
    }
    if (this.mode === 'reposition') {
      return this.reposition(vehicle, target, world, tick);
    }
    if (this.mode === 'engage') {
      return this.engage(vehicle, target, world);
    }
    return this.advance(vehicle, target, world, tick);
  }

  private advance(
    self: VehicleView,
    target: VehicleView,
    world: SimQueries,
    tick: number,
  ): VehicleCommand {
    const replanTicks = Math.round(this.def.engage.replanInterval / TICK_SECONDS);
    // Staggered by id, so several enemies don't all plan on the same tick (plan D3).
    const due = (tick + self.id * 7) % replanTicks === 0;
    if (this.needsSpot || (due && !this.spotStillGood(self, target, world))) {
      this.pickSpot(self, target, world, false);
    } else if (due) {
      this.planPath(self, world, true);
    }
    const step = this.follower.update(self.transform);
    if (step.status === 'replan') {
      this.planPath(self, world, true);
    }
    if (step.status === 'gave-up') {
      this.startReposition();
    }
    if (step.status === 'arrived' || (this.spot === undefined && this.inRange(self, target))) {
      if (this.canSee(self, target, world)) {
        this.startEngage();
      } else {
        this.startReposition();
      }
    }
    return this.drive(step);
  }

  /**
   * Stop, turn the front armor toward the target, track it with the turret,
   * fire when aligned and in sight (plan D9). Leaves when sight is lost for a
   * while, when the target gets behind it, or when it drifts out of range (D10).
   */
  private engage(self: VehicleView, target: VehicleView, world: SimQueries): VehicleCommand {
    const { engage } = this.def;
    const seen = this.canSee(self, target, world);
    this.ticksWithoutSight = seen ? 0 : this.ticksWithoutSight + 1;
    const toTarget = target.transform.position.sub(self.transform.position);
    const offNose = angleDelta(self.transform.heading, toTarget.heading());
    const distance = toTarget.length();
    const lostSight = this.ticksWithoutSight * TICK_SECONDS >= engage.lostSightTime;
    const behind = Math.abs(offNose) > engage.behindAngle && distance < engage.behindDistance;
    if (lostSight || behind || distance > engage.maxRange) {
      this.startReposition();
      return IDLE_COMMAND;
    }
    const turn =
      Math.abs(offNose) > engage.hullTolerance
        ? clamp(offNose / this.def.driving.fullTurnAngle, -1, 1)
        : 0;
    const aimPoint = this.aimPoint(self, target);
    const pivot = self.turretPivot();
    const aimError = angleDelta(self.turret.heading, aimPoint.sub(pivot).heading());
    // Once holding (winding up), small aim drift while tracking doesn't cancel the shot.
    const tolerance = engage.turretTolerance * (this.holding ? engage.holdSlack : 1);
    const fire = seen && Math.abs(aimError) <= tolerance;
    this.holding = fire;
    return { ...IDLE_COMMAND, turn, aimPoint, firePrimary: fire };
  }

  private reposition(
    self: VehicleView,
    target: VehicleView,
    world: SimQueries,
    tick: number,
  ): VehicleCommand {
    this.pickSpot(self, target, world, true);
    this.mode = 'advance';
    return this.advance(self, target, world, tick);
  }

  /** Where to aim: the target, led by `aimLead` × its travel during the shell's flight. */
  private aimPoint(self: VehicleView, target: VehicleView): Vec2 {
    const { aimLead } = this.def.engage;
    const position = target.transform.position;
    if (aimLead === 0) {
      return position;
    }
    const weapon = Object.values(self.def.loadout)[0];
    const speed = weapon?.projectile.speed ?? Number.POSITIVE_INFINITY;
    const flight = position.distanceTo(self.turretPivot()) / speed;
    return position.add(target.linearVelocity.scale(flight * aimLead));
  }

  private pickSpot(
    self: VehicleView,
    target: VehicleView,
    world: SimQueries,
    repositioning: boolean,
  ): void {
    this.spot = chooseFiringSpot(world, self, target, this.def.engage, { repositioning });
    this.needsSpot = false;
    // No spot with sight from here: close in on the target itself; `inRange` takes over.
    const goal = this.spot ?? target.transform.position;
    this.follower.setPath(
      world.findPath(self.transform.position, goal, self.id) ?? [],
      self.transform.position,
      false,
    );
  }

  private planPath(self: VehicleView, world: SimQueries, sameGoal: boolean): void {
    const goal = this.spot ?? this.follower.remaining.at(-1);
    if (goal === undefined) {
      return;
    }
    const path = world.findPath(self.transform.position, goal, self.id) ?? [];
    this.follower.setPath(path, self.transform.position, sameGoal);
  }

  /** A spot stays good while it still has sight of the target and is within the rings. */
  private spotStillGood(self: VehicleView, target: VehicleView, world: SimQueries): boolean {
    if (this.spot === undefined) {
      return false;
    }
    const { rings } = this.def.engage;
    const distance = this.spot.distanceTo(target.transform.position);
    const inRings = distance >= Math.min(...rings) - 2 && distance <= Math.max(...rings) + 2;
    const sight = { viewer: self.id, target: target.id };
    return inRings && world.lineOfSight(this.spot, target.transform.position, sight);
  }

  private inRange(self: VehicleView, target: VehicleView): boolean {
    const distance = self.transform.position.distanceTo(target.transform.position);
    return distance <= Math.max(...this.def.engage.rings);
  }

  private canSee(self: VehicleView, target: VehicleView, world: SimQueries): boolean {
    const sight = { viewer: self.id, target: target.id };
    return world.lineOfSight(self.turretPivot(), target.transform.position, sight);
  }

  private startEngage(): void {
    this.mode = 'engage';
    this.ticksWithoutSight = 0;
  }

  private startReposition(): void {
    this.mode = 'reposition';
    this.holding = false;
  }

  /** While moving, the turret looks along the path (T-108). */
  private drive(step: FollowStep): VehicleCommand {
    const aim = step.toward === undefined ? {} : { aimPoint: step.toward };
    return { ...IDLE_COMMAND, throttle: step.throttle, turn: step.turn, ...aim };
  }
}

/** The closest living vehicle of another faction. */
function nearestHostile(world: SimQueries, self: VehicleView): VehicleView | undefined {
  let best: VehicleView | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const vehicle of world.vehicles()) {
    if (vehicle.faction === self.faction || vehicle.health.depleted) {
      continue;
    }
    const distance = vehicle.transform.position.distanceTo(self.transform.position);
    if (distance < bestDistance) {
      best = vehicle;
      bestDistance = distance;
    }
  }
  return best;
}
