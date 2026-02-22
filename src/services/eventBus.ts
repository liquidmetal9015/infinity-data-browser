// Typed Event Bus for inter-widget communication

type EventCallback<T = any> = (data: T) => void;

class EventBus {
    private listeners = new Map<string, Set<EventCallback>>();

    on<T = any>(event: string, callback: EventCallback<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return an unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    off<T = any>(event: string, callback: EventCallback<T>): void {
        this.listeners.get(event)?.delete(callback);
    }

    emit<T = any>(event: string, data: T): void {
        this.listeners.get(event)?.forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error(`EventBus error in handler for "${event}":`, err);
            }
        });
    }
}

// Singleton instance
export const eventBus = new EventBus();

// Known event types for type safety in consumers
export interface WorkspaceEvents {
    'OPEN_CALCULATOR_FOR_UNIT': { unitSlug: string; profileId?: number };
    'LIST_UNIT_SELECTED': { unitSlug: string };
}
