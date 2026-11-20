import { describe, expect, it } from 'vitest';
import { intentToCommand } from '../../src/input/intentToCommand';
import { NO_INTENT, type PlayerIntent } from '../../src/input/PlayerIntent';
import { degToRad } from '../../src/sim/core/angles';
import type { Transform } from '../../src/sim/core/Transform';
import { Vec2 } from '../../src/sim/core/Vec2';

const TANK: Transform = { position: new Vec2(10, 20), heading: 0 };

function withDrive(drive: PlayerIntent['drive']): PlayerIntent {
  return { ...NO_INTENT, drive };
}

function withAim(aim: PlayerIntent['aim']): PlayerIntent {
  return { ...NO_INTENT, aim };
}

describe('intentToCommand', () => {
  describe('tank driving', () => {
    it('passes throttle, turn and fire buttons straight through', () => {
      const command = intentToCommand(
        { ...withDrive({ kind: 'tank', throttle: 0.5, turn: -1 }), firePrimary: true },
        TANK,
      );
      expect(command.throttle).toBe(0.5);
      expect(command.turn).toBe(-1);
      expect(command.firePrimary).toBe(true);
      expect(command.fireSecondary).toBe(false);
    });
  });

  describe('direct driving', () => {
    const direct = (direction: Vec2): PlayerIntent => withDrive({ kind: 'direct', direction });

    it('drives straight on when the stick points where the tank faces', () => {
      const command = intentToCommand(direct(new Vec2(0, 1)), TANK);
      expect(command.throttle).toBeCloseTo(1, 12);
      expect(command.turn).toBeCloseTo(0, 12);
    });

    it('turns at full rate without driving when the stick points 90° right', () => {
      const command = intentToCommand(direct(new Vec2(1, 0)), TANK);
      expect(command.turn).toBe(1);
      expect(command.throttle).toBeCloseTo(0, 12);
    });

    it('pivots instead of driving off when the stick points behind the tank', () => {
      const command = intentToCommand(direct(new Vec2(0.1, -1)), TANK);
      expect(command.throttle).toBe(0);
      expect(Math.abs(command.turn)).toBe(1);
    });

    it('turns proportionally for small errors and scales throttle by stick strength', () => {
      const tenDegreesLeft = Vec2.fromHeading(degToRad(-10)).scale(0.5);
      const command = intentToCommand(direct(tenDegreesLeft), TANK);
      expect(command.turn).toBeCloseTo(-10 / 30, 9);
      expect(command.throttle).toBeCloseTo(0.5 * Math.cos(degToRad(10)), 9);
    });

    it('a released stick means no throttle and no turn', () => {
      const command = intentToCommand(direct(Vec2.ZERO), TANK);
      expect(command.throttle).toBe(0);
      expect(command.turn).toBe(0);
    });
  });

  describe('aim', () => {
    it('a ground point is used as is', () => {
      const point = new Vec2(1, 2);
      expect(intentToCommand(withAim({ kind: 'point', point }), TANK).aimPoint).toBe(point);
    });

    it('a stick direction becomes a point 8 u from the tank in that direction', () => {
      const aim = withAim({ kind: 'direction', direction: new Vec2(0.3, 0) });
      const { aimPoint } = intentToCommand(aim, TANK);
      expect(aimPoint?.x).toBeCloseTo(18, 12);
      expect(aimPoint?.z).toBeCloseTo(20, 12);
    });

    it('no aim gives no aim point, so the turret holds its heading', () => {
      expect(intentToCommand(NO_INTENT, TANK).aimPoint).toBeUndefined();
    });
  });
});
