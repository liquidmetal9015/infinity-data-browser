import { create } from 'zustand';
import type { Unit } from '@shared/types';

interface ListBuilderUIStore {
    selectedUnitForDetail: Unit | null;
    selectedProfileGroupId: number | null;
    hoveredFireteamId: string | null;
    hoveredUnitISC: string | null;
    targetGroupIndex: number;
    rosterScrollTarget: { unitId: number } | null;
    highlightedListUnitId: string | null;
    selectUnitForDetail: (unit: Unit | null, profileGroupId?: number | null) => void;
    setHoveredFireteamId: (id: string | null) => void;
    setHoveredUnitISC: (isc: string | null) => void;
    setTargetGroupIndex: (idx: number) => void;
    setRosterScrollTarget: (target: { unitId: number } | null) => void;
    setHighlightedListUnitId: (id: string | null) => void;
}

export const useListBuilderUIStore = create<ListBuilderUIStore>()((set) => ({
    selectedUnitForDetail: null,
    selectedProfileGroupId: null,
    hoveredFireteamId: null,
    hoveredUnitISC: null,
    targetGroupIndex: 0,
    rosterScrollTarget: null,
    highlightedListUnitId: null,
    selectUnitForDetail: (unit, profileGroupId = null) => set({ selectedUnitForDetail: unit, selectedProfileGroupId: profileGroupId }),
    setHoveredFireteamId: (id) => set({ hoveredFireteamId: id }),
    setHoveredUnitISC: (isc) => set({ hoveredUnitISC: isc }),
    setTargetGroupIndex: (idx) => set({ targetGroupIndex: idx }),
    setRosterScrollTarget: (target) => set({ rosterScrollTarget: target }),
    setHighlightedListUnitId: (id) => set({ highlightedListUnitId: id }),
}));
