import { describe, expect, it } from 'vitest';
import { TickQueue } from '../../src/app/TickQueue';

describe('TickQueue', () => {
  it('hands items back once their tick arrives, in the order added, and only once', () => {
    const queue = new TickQueue<string>();
    queue.add(24, 'b');
    queue.add(10, 'a');
    queue.add(24, 'c');
    expect(queue.takeDue(9)).toEqual([]);
    expect(queue.takeDue(10)).toEqual(['a']);
    expect(queue.takeDue(30)).toEqual(['b', 'c']);
    expect(queue.takeDue(30)).toEqual([]);
    expect(queue.size).toBe(0);
  });
});
