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
export async function clearAllPersistedState(): Promise<void> {
    // 1. Clear all localStorage for this origin (ignoring specific keys to be fully comprehensive)
    localStorage.clear();

    // 2. Clear all sessionStorage just in case
    sessionStorage.clear();

    // 3. Attempt to clear all IndexedDB databases
    if (window.indexedDB && window.indexedDB.databases) {
        try {
            const dbs = await window.indexedDB.databases();
            const promises = dbs.map(db => {
                if (db.name) {
                    return new Promise<void>((resolve, reject) => {
                        const req = window.indexedDB.deleteDatabase(db.name!);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                        req.onblocked = () => resolve(); // continue even if blocked
                    });
                }
                return Promise.resolve();
            });
            await Promise.all(promises);
        } catch (err) {
            console.error("Could not clear IndexedDB:", err);
        }
    }
}

/**
 * Clears all persisted state and navigates back to the root, reloading everything.
 * This is the user-facing action — it's immediate and complete.
 */
export async function clearAllDataAndReload(): Promise<void> {
    await clearAllPersistedState();

    // Clear URL hashes or query params to avoid reopening a saved state
    window.location.href = window.location.origin + window.location.pathname;
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
