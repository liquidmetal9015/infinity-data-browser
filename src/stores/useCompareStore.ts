// Zustand store for Compare Page state
// Persists selected faction IDs between navigation and workspace windows

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompareStore {
    selectedFactionIds: number[];
    addFaction: (id: number) => void;
    removeFaction: (id: number) => void;
    addMultipleFactions: (ids: number[]) => void;
    setFactions: (ids: number[]) => void;
    clearAll: () => void;
}

export const useCompareStore = create<CompareStore>()(
    persist(
        (set) => ({
            selectedFactionIds: [],

            addFaction: (id) => set(s => ({
                selectedFactionIds: s.selectedFactionIds.includes(id)
                    ? s.selectedFactionIds
                    : [...s.selectedFactionIds, id],
            })),

            removeFaction: (id) => set(s => ({
                selectedFactionIds: s.selectedFactionIds.filter(fid => fid !== id),
            })),

            addMultipleFactions: (ids) => set(s => {
                const existing = new Set(s.selectedFactionIds);
                ids.forEach(id => existing.add(id));
                return { selectedFactionIds: Array.from(existing) };
            }),

            setFactions: (ids) => set({ selectedFactionIds: ids }),

            clearAll: () => set({ selectedFactionIds: [] }),
        }),
        {
            name: 'infinity-compare-state',
        }
    )
);
