import type { WaveStatus } from '../sim/modes/WaveSurvivalMode';

/** The big centre text, and how it should look. */
export interface BannerState {
  readonly text: string;
  readonly tone: 'info' | 'good' | 'bad';
}

/** What the HUD shows about the run (M5-6a, plan D10), as plain strings. */
export interface WaveHudState {
  /** "Wave 2 / 5". */
  readonly wave: string;
  /** Enemies still to beat this wave (alive + not yet spawned); hidden between waves. */
  readonly enemies: string | undefined;
  /** "Next wave in 4" during the breather. */
  readonly countdown: string | undefined;
  readonly banner: BannerState | undefined;
}

/**
 * Turns the mode's status into HUD text, so the rules (which banner when,
 * how the countdown rounds) are unit-tested without a DOM (`tests/ui/`).
 */
export function waveHudState(status: WaveStatus): WaveHudState {
  const fighting = status.phase === 'banner' || status.phase === 'fighting';
  return {
    wave: `Wave ${status.wave} / ${status.waves}`,
    enemies: fighting ? String(status.enemiesLeft) : undefined,
    countdown:
      status.phase === 'breather'
        ? `Next wave in ${Math.max(1, Math.ceil(status.secondsLeft))}`
        : undefined,
    banner: bannerFor(status),
  };
}

function bannerFor(status: WaveStatus): BannerState | undefined {
  switch (status.phase) {
    case 'banner':
      return { text: `WAVE ${status.wave} / ${status.waves}`, tone: 'info' };
    case 'cleared':
      return { text: 'WAVE CLEARED', tone: 'good' };
    case 'victory':
      return { text: 'VICTORY', tone: 'good' };
    case 'defeat':
      return { text: 'DESTROYED', tone: 'bad' };
    case 'fighting':
    case 'breather':
      return undefined;
  }
}
