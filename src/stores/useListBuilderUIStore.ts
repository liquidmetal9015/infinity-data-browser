import { create } from 'zustand';
import type { Unit } from '@shared/types';

interface ListBuilderUIStore {
    selectedUnitForDetail: Unit | null;
    selectedProfileGroupId: number | null;
    selectedOptionId: number | null;
    detailFactionId: number | null;
    highlightTick: number;
    hoveredFireteamId: string | null;
    hoveredUnitISC: string | null;
    targetGroupIndex: number;
    rosterScrollTarget: { unitId: number; optionId?: number; profileGroupId?: number } | null;
    detailsExpanded: boolean;
    selectUnitForDetail: (unit: Unit | null, profileGroupId?: number | null, optionId?: number | null, factionId?: number | null) => void;
    setHoveredFireteamId: (id: string | null) => void;
    setHoveredUnitISC: (isc: string | null) => void;
    setTargetGroupIndex: (idx: number) => void;
    setRosterScrollTarget: (target: { unitId: number; optionId?: number; profileGroupId?: number } | null) => void;
    setDetailsExpanded: (expanded: boolean) => void;
}

export const useListBuilderUIStore = create<ListBuilderUIStore>()((set, get) => ({
    selectedUnitForDetail: null,
    selectedProfileGroupId: null,
    selectedOptionId: null,
    detailFactionId: null,
    highlightTick: 0,
    hoveredFireteamId: null,
    hoveredUnitISC: null,
    targetGroupIndex: 0,
    rosterScrollTarget: null,
    detailsExpanded: false,
    selectUnitForDetail: (unit, profileGroupId = null, optionId = null, factionId = null) => set({ selectedUnitForDetail: unit, selectedProfileGroupId: profileGroupId, selectedOptionId: optionId, detailFactionId: factionId, highlightTick: get().highlightTick + 1 }),
    setHoveredFireteamId: (id) => set({ hoveredFireteamId: id }),
    setHoveredUnitISC: (isc) => set({ hoveredUnitISC: isc }),
    setTargetGroupIndex: (idx) => set({ targetGroupIndex: idx }),
    setRosterScrollTarget: (target) => set({ rosterScrollTarget: target }),
    setDetailsExpanded: (expanded) => set({ detailsExpanded: expanded }),
}));
