// Zustand store for Ranges/Weapons Page state
// Persists selected weapon IDs between navigation and workspace windows

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RangesStore {
    selectedWeaponIds: number[];
    weaponSearch: string;

    toggleWeapon: (id: number) => void;
    setSelectedWeaponIds: (ids: number[]) => void;
    setWeaponSearch: (search: string) => void;
    clearSelection: () => void;
}

export const useRangesStore = create<RangesStore>()(
    persist(
        (set) => ({
            selectedWeaponIds: [],
            weaponSearch: '',

            toggleWeapon: (id) => set(s => {
                const next = s.selectedWeaponIds.includes(id)
                    ? s.selectedWeaponIds.filter(wid => wid !== id)
                    : [...s.selectedWeaponIds, id];
                return { selectedWeaponIds: next };
            }),

            setSelectedWeaponIds: (ids) => set({ selectedWeaponIds: ids }),
            setWeaponSearch: (search) => set({ weaponSearch: search }),
            clearSelection: () => set({ selectedWeaponIds: [], weaponSearch: '' }),
        }),
        {
            name: 'infinity-ranges-state',
            partialize: (state) => ({
                selectedWeaponIds: state.selectedWeaponIds,
                // Don't persist search text — it's ephemeral
            }),
        }
    )
);
