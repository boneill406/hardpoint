type Handler<Payload> = (payload: Payload) => void;

/** One queued event; the union keeps each name paired with its own payload type. */
type QueuedEvent<Events> = {
  [Name in keyof Events]: { readonly name: Name; readonly payload: Events[Name] };
}[keyof Events];

/**
 * Typed, buffered publish/subscribe for simulation events (M1 plan, D2).
 *
 * `emit` only queues. Nothing reaches subscribers until the app calls `flush()`
 * after the frame's ticks, so render, audio and HUD code never runs in the
 * middle of a tick and can't observe half-updated state. The cost: effects can
 * start up to one frame after the tick that caused them.
 *
 * `Events` maps event names to payload types (see `SimEvents`).
 */
export class EventBus<Events extends object> {
  private queue: QueuedEvent<Events>[] = [];
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Queues an event for the next `flush()`. */
  emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void {
    this.queue.push({ name, payload });
  }

  /**
   * Subscribes to one event name and returns a function that unsubscribes.
   * Handlers run in subscription order. Subscribing the same function twice has
   * no extra effect.
   */
  on<Name extends keyof Events>(name: Name, handler: Handler<Events[Name]>): () => void {
    let set = this.handlers.get(name);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /**
   * Delivers every queued event in emission order, then leaves the queue empty.
   * Events emitted by handlers during a flush wait for the next flush, so a
   * handler that emits can't loop forever. A handler unsubscribed mid-flush
   * receives nothing further.
   */
  flush(): void {
    const delivering = this.queue;
    this.queue = [];
    for (const event of delivering) {
      this.deliver(event);
    }
  }

  private deliver(event: QueuedEvent<Events>): void {
    const set = this.handlers.get(event.name);
    if (set === undefined) {
      return;
    }
    for (const handler of [...set]) {
      if (set.has(handler)) {
        // Handlers are stored under their own event name by `on`, so this payload matches.
        (handler as Handler<typeof event.payload>)(event.payload);
      }
    }
  }
}
