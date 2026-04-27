import { create } from 'zustand';
import type { Unit } from '@shared/types';

interface ListBuilderUIStore {
    selectedUnitForDetail: Unit | null;
    hoveredFireteamId: string | null;
    hoveredUnitISC: string | null;
    targetGroupIndex: number;
    selectUnitForDetail: (unit: Unit | null) => void;
    setHoveredFireteamId: (id: string | null) => void;
    setHoveredUnitISC: (isc: string | null) => void;
    setTargetGroupIndex: (idx: number) => void;
}

export const useListBuilderUIStore = create<ListBuilderUIStore>()((set) => ({
    selectedUnitForDetail: null,
    hoveredFireteamId: null,
    hoveredUnitISC: null,
    targetGroupIndex: 0,
    selectUnitForDetail: (unit) => set({ selectedUnitForDetail: unit }),
    setHoveredFireteamId: (id) => set({ hoveredFireteamId: id }),
    setHoveredUnitISC: (isc) => set({ hoveredUnitISC: isc }),
    setTargetGroupIndex: (idx) => set({ targetGroupIndex: idx }),
}));
