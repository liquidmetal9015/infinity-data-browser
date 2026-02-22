// Centralized utility for clearing all persisted state
// localStorage keys used by Zustand stores

const STORE_KEYS = [
    'infinity-list-state',
    'infinity-dice-calc-state',
    'infinity-compare-state',
    'infinity-ranges-state',
    'infinity-classifieds-state',
    'infinity-workspace',  // WorkspaceContext
] as const;

/**
 * Clears all persisted application state from localStorage.
 * After calling this, you should reload the page to reset in-memory store state.
 */
export function clearAllPersistedState(): void {
    STORE_KEYS.forEach(key => {
        localStorage.removeItem(key);
    });
}

/**
 * Clears all persisted state and reloads the page.
 * This is the user-facing action — it's immediate and complete.
 */
export function clearAllDataAndReload(): void {
    clearAllPersistedState();
    window.location.reload();
}

/**
 * Returns a list of all localStorage keys used by the application
 * and their current sizes in bytes.
 */
export function getPersistedDataSummary(): { key: string; sizeBytes: number }[] {
    return STORE_KEYS.map(key => {
        const value = localStorage.getItem(key);
        return {
            key,
            sizeBytes: value ? new Blob([value]).size : 0,
        };
    }).filter(item => item.sizeBytes > 0);
}
