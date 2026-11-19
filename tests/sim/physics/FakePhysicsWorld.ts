import type { PhysicsWorld } from '../../../src/sim/physics/PhysicsWorld';

/** Records calls instead of simulating, so tests can check how the sim drives physics. */
export class FakePhysicsWorld implements PhysicsWorld {
  readonly steps: number[] = [];
  disposed = false;

  step(dt: number): void {
    this.steps.push(dt);
  }

  dispose(): void {
    this.disposed = true;
  }
}
