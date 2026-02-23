import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ClassifiedsStore {
    selectedClassified: number | null;
    selectedUnitISC: string | null;
    selectedProfileId: number | null;

    setSelectedClassified: (id: number | null) => void;
    setSelectedUnitISC: (isc: string | null) => void;
    setSelectedProfileId: (id: number | null) => void;
    resetAll: () => void;
}

export const useClassifiedsStore = create<ClassifiedsStore>()(
    persist(
        (set) => ({
            selectedClassified: null,
            selectedUnitISC: null,
            selectedProfileId: null,

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
                selectedClassified: null,
                selectedUnitISC: null,
                selectedProfileId: null,
            }),
        }),
        {
            name: 'infinity-classifieds-state',
        }
    )
);

