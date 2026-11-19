import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/sim/core/EventBus';
import type { SimEvents } from '../../../src/sim/core/SimEvents';

function createBus(): EventBus<SimEvents> {
  return new EventBus<SimEvents>();
}

describe('EventBus', () => {
  describe('buffering', () => {
    it('delivers nothing before flush', () => {
      const bus = createBus();
      const received: number[] = [];
      bus.on('EntitySpawned', ({ id }) => received.push(id));

      bus.emit('EntitySpawned', { id: 1 });
      expect(received).toEqual([]);

      bus.flush();
      expect(received).toEqual([1]);
    });

    it('keeps emission order across event types', () => {
      const bus = createBus();
      const log: string[] = [];
      bus.on('EntitySpawned', ({ id }) => log.push(`spawned ${id}`));
      bus.on('EntityDestroyed', ({ id }) => log.push(`destroyed ${id}`));

      bus.emit('EntitySpawned', { id: 1 });
      bus.emit('EntityDestroyed', { id: 1 });
      bus.emit('EntitySpawned', { id: 2 });
      bus.flush();

      expect(log).toEqual(['spawned 1', 'destroyed 1', 'spawned 2']);
    });

    it('flush empties the queue, so a second flush delivers nothing', () => {
      const bus = createBus();
      let calls = 0;
      bus.on('EntitySpawned', () => calls++);

      bus.emit('EntitySpawned', { id: 1 });
      bus.flush();
      bus.flush();

      expect(calls).toBe(1);
    });

    it('events emitted by a handler during flush wait for the next flush', () => {
      const bus = createBus();
      const destroyed: number[] = [];
      bus.on('EntitySpawned', ({ id }) => bus.emit('EntityDestroyed', { id }));
      bus.on('EntityDestroyed', ({ id }) => destroyed.push(id));

      bus.emit('EntitySpawned', { id: 7 });
      bus.flush();
      expect(destroyed).toEqual([]);

      bus.flush();
      expect(destroyed).toEqual([7]);
    });

    it('drops events nobody subscribes to without error', () => {
      const bus = createBus();
      bus.emit('EntityDestroyed', { id: 3 });
      expect(() => bus.flush()).not.toThrow();
    });
  });

  describe('subscribers', () => {
    it('every subscriber receives the event, in subscription order', () => {
      const bus = createBus();
      const log: string[] = [];
      bus.on('EntitySpawned', () => log.push('vfx'));
      bus.on('EntitySpawned', () => log.push('audio'));

      bus.emit('EntitySpawned', { id: 1 });
      bus.flush();

      expect(log).toEqual(['vfx', 'audio']);
    });

    it('a subscriber only receives the event name it subscribed to', () => {
      const bus = createBus();
      let spawned = 0;
      bus.on('EntitySpawned', () => spawned++);

      bus.emit('EntityDestroyed', { id: 1 });
      bus.flush();

      expect(spawned).toBe(0);
    });

    it('unsubscribe stops further delivery', () => {
      const bus = createBus();
      const received: number[] = [];
      const off = bus.on('EntitySpawned', ({ id }) => received.push(id));

      bus.emit('EntitySpawned', { id: 1 });
      bus.flush();
      off();
      bus.emit('EntitySpawned', { id: 2 });
      bus.flush();

      expect(received).toEqual([1]);
    });

    it('a handler unsubscribed during flush receives no further events', () => {
      const bus = createBus();
      const received: number[] = [];
      let offSecond = (): void => {};
      bus.on('EntitySpawned', () => offSecond());
      offSecond = bus.on('EntitySpawned', ({ id }) => received.push(id));

      bus.emit('EntitySpawned', { id: 1 });
      bus.flush();

      expect(received).toEqual([]);
    });

    it('subscribing the same handler twice delivers once', () => {
      const bus = createBus();
      let calls = 0;
      const handler = (): void => {
        calls++;
      };
      bus.on('EntitySpawned', handler);
      bus.on('EntitySpawned', handler);

      bus.emit('EntitySpawned', { id: 1 });
      bus.flush();

      expect(calls).toBe(1);
    });
  });

  describe('typing (checked by npm run typecheck)', () => {
    it('rejects unknown event names and wrong payloads at compile time', () => {
      const bus = createBus();
      // @ts-expect-error: no such event
      bus.emit('EntityExploded', { id: 1 });
      // @ts-expect-error: payload field has the wrong type
      bus.emit('EntitySpawned', { id: 'one' });
      // @ts-expect-error: payload is missing its field
      bus.emit('EntityDestroyed', {});
      bus.flush();
    });
  });
});
