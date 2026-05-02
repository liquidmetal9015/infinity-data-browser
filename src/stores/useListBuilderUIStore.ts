import { create } from 'zustand';
import type { Unit } from '@shared/types';

interface ListBuilderUIStore {
    selectedUnitForDetail: Unit | null;
    selectedProfileGroupId: number | null;
    selectedOptionId: number | null;
    highlightTick: number;
    hoveredFireteamId: string | null;
    hoveredUnitISC: string | null;
    targetGroupIndex: number;
    rosterScrollTarget: { unitId: number; optionId?: number } | null;
    selectUnitForDetail: (unit: Unit | null, profileGroupId?: number | null, optionId?: number | null) => void;
    setHoveredFireteamId: (id: string | null) => void;
    setHoveredUnitISC: (isc: string | null) => void;
    setTargetGroupIndex: (idx: number) => void;
    setRosterScrollTarget: (target: { unitId: number; optionId?: number } | null) => void;
}

export const useListBuilderUIStore = create<ListBuilderUIStore>()((set, get) => ({
    selectedUnitForDetail: null,
    selectedProfileGroupId: null,
    selectedOptionId: null,
    highlightTick: 0,
    hoveredFireteamId: null,
    hoveredUnitISC: null,
    targetGroupIndex: 0,
    rosterScrollTarget: null,
    selectUnitForDetail: (unit, profileGroupId = null, optionId = null) => set({ selectedUnitForDetail: unit, selectedProfileGroupId: profileGroupId, selectedOptionId: optionId, highlightTick: get().highlightTick + 1 }),
    setHoveredFireteamId: (id) => set({ hoveredFireteamId: id }),
    setHoveredUnitISC: (isc) => set({ hoveredUnitISC: isc }),
    setTargetGroupIndex: (idx) => set({ targetGroupIndex: idx }),
    setRosterScrollTarget: (target) => set({ rosterScrollTarget: target }),
}));
