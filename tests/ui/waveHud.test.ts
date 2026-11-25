import { describe, expect, it } from 'vitest';
import type { WaveStatus } from '../../src/sim/modes/WaveSurvivalMode';
import { waveHudState } from '../../src/ui/waveHud';

function status(over: Partial<WaveStatus>): WaveStatus {
  return { phase: 'fighting', wave: 2, waves: 5, enemiesLeft: 2, secondsLeft: 0, ...over };
}

describe('waveHudState', () => {
  it('shows the wave and enemies left while a wave is on, with no banner once fighting', () => {
    expect(waveHudState(status({}))).toEqual({
      wave: 'Wave 2 / 5',
      enemies: '2',
      countdown: undefined,
      banner: undefined,
    });
  });

  it('announces the wave with a banner before it starts', () => {
    expect(waveHudState(status({ phase: 'banner', secondsLeft: 1.5 })).banner).toEqual({
      text: 'WAVE 2 / 5',
      tone: 'info',
    });
  });

  it('"WAVE CLEARED", then a whole-second countdown that never shows 0', () => {
    expect(waveHudState(status({ phase: 'cleared' })).banner?.text).toBe('WAVE CLEARED');
    expect(waveHudState(status({ phase: 'cleared' })).enemies).toBeUndefined();
    expect(waveHudState(status({ phase: 'breather', secondsLeft: 5 })).countdown).toBe(
      'Next wave in 5',
    );
    expect(waveHudState(status({ phase: 'breather', secondsLeft: 3.2 })).countdown).toBe(
      'Next wave in 4',
    );
    expect(waveHudState(status({ phase: 'breather', secondsLeft: 0 })).countdown).toBe(
      'Next wave in 1',
    );
  });

  it('ends with VICTORY or DESTROYED', () => {
    expect(waveHudState(status({ phase: 'victory', wave: 5 })).banner).toEqual({
      text: 'VICTORY',
      tone: 'good',
    });
    expect(waveHudState(status({ phase: 'defeat' })).banner).toEqual({
      text: 'DESTROYED',
      tone: 'bad',
    });
  });
});
