import { describe, expect, it } from 'vitest';
import { GameFlow } from '../../src/app/GameFlow';

describe('GameFlow', () => {
  it('starts on the title, not ticking; starting the run ticks', () => {
    const flow = new GameFlow('title');
    expect(flow.state).toBe('title');
    expect(flow.ticking).toBe(false);
    expect(flow.start()).toBe(true);
    expect(flow.state).toBe('playing');
    expect(flow.ticking).toBe(true);
  });

  it('pauses and resumes; paused does not tick; pause only applies while playing', () => {
    const flow = new GameFlow('title');
    expect(flow.pause()).toBe(false);
    flow.start();
    expect(flow.pause()).toBe(true);
    expect(flow.ticking).toBe(false);
    expect(flow.pause()).toBe(false);
    expect(flow.resume()).toBe(true);
    expect(flow.state).toBe('playing');
  });

  it('a defeat holds 1.5 s (still ticking), then shows the summary', () => {
    const flow = new GameFlow('playing');
    flow.runEnded('defeat');
    expect(flow.state).toBe('ending');
    expect(flow.ticking).toBe(true);
    expect(flow.outcome).toBe('defeat');
    flow.update(1.4);
    expect(flow.state).toBe('ending');
    flow.update(0.1);
    expect(flow.state).toBe('summary');
    expect(flow.ticking).toBe(false);
  });

  it('a victory holds 2 s', () => {
    const flow = new GameFlow('playing');
    flow.runEnded('victory');
    flow.update(1.9);
    expect(flow.state).toBe('ending');
    flow.update(0.2);
    expect(flow.state).toBe('summary');
  });

  it('cannot pause during the end hold, and a second RunEnded is ignored', () => {
    const flow = new GameFlow('playing');
    flow.runEnded('defeat');
    expect(flow.pause()).toBe(false);
    flow.runEnded('victory');
    expect(flow.outcome).toBe('defeat');
  });

  it('a new run clears the outcome and goes to the title or straight to playing', () => {
    const flow = new GameFlow('playing');
    flow.runEnded('defeat');
    flow.update(5);
    flow.newRun('playing');
    expect(flow.state).toBe('playing');
    expect(flow.outcome).toBeUndefined();
    flow.newRun('title');
    expect(flow.state).toBe('title');
  });
});
