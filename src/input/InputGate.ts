import type { PlayerIntent } from './PlayerIntent';

/**
 * Holds back driving and firing after a menu (M5-4b): the key or button that
 * started or resumed the run is usually still down when play begins, and
 * driving and firing are hold-to-act, so the tank would react to it. Once
 * blocked, drive and fire stay idle until a frame where nothing is held.
 * Aim always passes, so the turret follows the mouse at once.
 */
export class InputGate {
  private blocked = false;

  /** Called when play starts or resumes. */
  block(): void {
    this.blocked = true;
  }

  filter(intent: PlayerIntent): PlayerIntent {
    if (!this.blocked) {
      return intent;
    }
    if (!holdsAnything(intent)) {
      this.blocked = false;
      return intent;
    }
    return {
      ...intent,
      drive: { kind: 'tank', throttle: 0, turn: 0 },
      firePrimary: false,
      fireSecondary: false,
    };
  }
}

/** Any drive or fire input (aim doesn't count: the mouse always points somewhere). */
function holdsAnything(intent: PlayerIntent): boolean {
  const { drive } = intent;
  const driving =
    drive.kind === 'tank'
      ? drive.throttle !== 0 || drive.turn !== 0
      : drive.direction.length() !== 0;
  return driving || intent.firePrimary || intent.fireSecondary;
}
