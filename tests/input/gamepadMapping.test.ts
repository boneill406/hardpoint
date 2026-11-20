import { describe, expect, it } from 'vitest';
import { PAD, PAD_SCHEMES, STICK_DEADZONE } from '../../src/input/bindings';
import { gamepadIntent, radialDeadzone, type GamepadState } from '../../src/input/gamepadMapping';
import type { DriveIntent } from '../../src/input/PlayerIntent';

/** A pad at rest with the given axes and button values overridden. */
function pad(
  axes: Record<number, number> = {},
  buttons: Record<number, number> = {},
): GamepadState {
  const axisValues = [0, 0, 0, 0].map((value, i) => axes[i] ?? value);
  const buttonValues = Array.from({ length: 17 }, (_, i) => buttons[i] ?? 0);
  return { axes: axisValues, buttons: buttonValues };
}

function tankDrive(drive: DriveIntent): { throttle: number; turn: number } {
  if (drive.kind !== 'tank') {
    throw new Error(`expected tank drive, got ${drive.kind}`);
  }
  return { throttle: drive.throttle, turn: drive.turn };
}

describe('radialDeadzone', () => {
  it('zeroes input inside the deadzone', () => {
    expect(radialDeadzone(0.1, -0.05, STICK_DEADZONE).length()).toBe(0);
  });

  it('rescales so full deflection is still 1 and just outside starts near 0', () => {
    expect(radialDeadzone(1, 0, STICK_DEADZONE).x).toBeCloseTo(1, 12);
    expect(radialDeadzone(STICK_DEADZONE + 0.01, 0, STICK_DEADZONE).x).toBeLessThan(0.02);
  });

  it('keeps the direction of diagonal input', () => {
    const v = radialDeadzone(0.6, 0.6, STICK_DEADZONE);
    expect(v.x).toBeCloseTo(v.z, 12);
  });
});

describe('gamepadIntent', () => {
  describe('tank scheme (GDD default)', () => {
    const scheme = PAD_SCHEMES.tank;

    it('left stick up drives forward and right turns clockwise', () => {
      const drive = tankDrive(gamepadIntent(pad({ [PAD.axes.leftY]: -1 }), scheme).drive);
      expect(drive.throttle).toBeCloseTo(1, 12);
      expect(tankDrive(gamepadIntent(pad({ [PAD.axes.leftX]: 1 }), scheme).drive).turn).toBeCloseTo(
        1,
        12,
      );
    });

    it('RT fires primary and LT fires secondary', () => {
      const intent = gamepadIntent(pad({}, { [PAD.buttons.rt]: 1, [PAD.buttons.lt]: 0.8 }), scheme);
      expect(intent.firePrimary).toBe(true);
      expect(intent.fireSecondary).toBe(true);
    });

    it('a lightly pressed trigger does not fire', () => {
      expect(gamepadIntent(pad({}, { [PAD.buttons.rt]: 0.3 }), scheme).firePrimary).toBe(false);
    });
  });

  describe('direct scheme', () => {
    it('left stick becomes a world direction: up = +z, right = +x', () => {
      const drive = gamepadIntent(pad({ [PAD.axes.leftX]: 1 }), PAD_SCHEMES.direct).drive;
      expect(drive.kind).toBe('direct');
      if (drive.kind === 'direct') {
        expect(drive.direction.x).toBeCloseTo(1, 12);
      }
      const up = gamepadIntent(pad({ [PAD.axes.leftY]: -1 }), PAD_SCHEMES.direct).drive;
      if (up.kind === 'direct') {
        expect(up.direction.z).toBeCloseTo(1, 12);
      }
    });
  });

  describe('triggers scheme', () => {
    const scheme = PAD_SCHEMES.triggers;

    it('RT drives forward, LT reverses, both cancel; left stick X turns', () => {
      const forward = gamepadIntent(pad({}, { [PAD.buttons.rt]: 1 }), scheme);
      const reverse = gamepadIntent(pad({}, { [PAD.buttons.lt]: 0.5 }), scheme);
      const both = gamepadIntent(pad({}, { [PAD.buttons.rt]: 1, [PAD.buttons.lt]: 1 }), scheme);
      const turning = gamepadIntent(pad({ [PAD.axes.leftX]: -1 }), scheme);
      expect(tankDrive(forward.drive).throttle).toBe(1);
      expect(tankDrive(reverse.drive).throttle).toBe(-0.5);
      expect(tankDrive(both.drive).throttle).toBe(0);
      expect(tankDrive(turning.drive).turn).toBeCloseTo(-1, 12);
    });

    it('fires on the bumpers, since the triggers drive', () => {
      const intent = gamepadIntent(pad({}, { [PAD.buttons.rt]: 1 }), scheme);
      expect(intent.firePrimary).toBe(false);
      expect(gamepadIntent(pad({}, { [PAD.buttons.rb]: 1 }), scheme).firePrimary).toBe(true);
      expect(gamepadIntent(pad({}, { [PAD.buttons.lb]: 1 }), scheme).fireSecondary).toBe(true);
    });
  });

  describe('aim (all schemes)', () => {
    it('right stick gives a world aim direction; at rest it gives none', () => {
      const aim = gamepadIntent(pad({ [PAD.axes.rightY]: -1 }), PAD_SCHEMES.tank).aim;
      expect(aim.kind).toBe('direction');
      if (aim.kind === 'direction') {
        expect(aim.direction.z).toBeCloseTo(1, 12);
      }
      expect(gamepadIntent(pad(), PAD_SCHEMES.tank).aim).toEqual({ kind: 'none' });
    });
  });
});
