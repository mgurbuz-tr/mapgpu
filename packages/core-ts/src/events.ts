/**
 * Typed Event Bus
 *
 * Harita, katman ve view olaylarını yönetir.
 * Tüm event'ler tiplenmiştir — runtime hata riski minimumdur.
 */

type EventHandler<T> = (data: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<
    keyof EventMap,
    Set<EventHandler<unknown>>
  >();

  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Event handler error [${String(event)}]:`, err);
      }
    }
  }

  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    const wrapper = ((data: EventMap[K]) => {
      this.off(event, wrapper);
      handler(data);
    }) as EventHandler<EventMap[K]>;
    this.on(event, wrapper);
  }

  removeAll(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
