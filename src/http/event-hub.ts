export interface AppEvent {
  type: string;
  data: Record<string, unknown>;
  at: string;
}

export type EventListener = (event: AppEvent) => void;

export class EventHub {
  private readonly listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(type: string, data: Record<string, unknown> = {}): void {
    const event: AppEvent = {
      type,
      data,
      at: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A broken SSE client must not fail the reservation mutation.
      }
    }
  }

  get size(): number {
    return this.listeners.size;
  }
}
