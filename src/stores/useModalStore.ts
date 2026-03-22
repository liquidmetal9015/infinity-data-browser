import { create } from 'zustand';
import type { Unit } from '@shared/types';

interface ModalStore {
    selectedUnit: Unit | null;
    isOpen: boolean;
    openUnitModal: (unit: Unit) => void;
    closeModal: () => void;
}

export const useModalStore = create<ModalStore>()((set) => ({
    selectedUnit: null,
    isOpen: false,
    openUnitModal: (unit) => set({ selectedUnit: unit, isOpen: true }),
    closeModal: () => set({ isOpen: false, selectedUnit: null }),
}));
