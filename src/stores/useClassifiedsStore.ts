// Zustand store for Classifieds Page state
// Persists selected faction between navigation and workspace windows

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ClassifiedsStore {
    selectedFactionId: number | null;
    selectedClassified: number | null;
    selectedUnitISC: string | null;
    selectedProfileId: number | null;

    setSelectedFactionId: (id: number | null) => void;
    setSelectedClassified: (id: number | null) => void;
    setSelectedUnitISC: (isc: string | null) => void;
    setSelectedProfileId: (id: number | null) => void;
    resetAll: () => void;
}

export const useClassifiedsStore = create<ClassifiedsStore>()(
    persist(
        (set) => ({
            selectedFactionId: null,
            selectedClassified: null,
            selectedUnitISC: null,
            selectedProfileId: null,

            setSelectedFactionId: (id) => set({
                selectedFactionId: id,
                selectedClassified: null,
                selectedUnitISC: null,
                selectedProfileId: null,
            }),

            setSelectedClassified: (id) => set({
                selectedClassified: id,
                selectedUnitISC: null,
                selectedProfileId: null,
            }),

            setSelectedUnitISC: (isc) => set({
                selectedUnitISC: isc,
                selectedProfileId: null,
                selectedClassified: null,
            }),

            setSelectedProfileId: (id) => set({
                selectedProfileId: id,
                selectedClassified: null,
            }),

            resetAll: () => set({
                selectedFactionId: null,
                selectedClassified: null,
                selectedUnitISC: null,
                selectedProfileId: null,
            }),
        }),
        {
            name: 'infinity-classifieds-state',
            partialize: (state) => ({
                selectedFactionId: state.selectedFactionId,
                // Don't persist transient selection state
            }),
        }
    )
);
