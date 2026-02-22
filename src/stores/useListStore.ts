// Zustand store for army list state
// Replaces ListContext with a global store that persists to localStorage
// and shares state between workspace windows and full-screen pages.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit } from '../types';
import { listReducer, initialState, type ListState, type ListAction } from '../logic/ListLogic';

// ============================================================================
// Store Interface
// ============================================================================

interface ListStore extends ListState {
    // Actions (same API as the old ListContext)
    createList: (factionId: number, factionName: string, pointsLimit?: number, name?: string) => void;
    addUnit: (unit: Unit, groupIndex: number, profileGroupId: number, profileId: number, optionId: number) => void;
    removeUnit: (groupIndex: number, unitId: string) => void;
    addCombatGroup: () => void;
    removeCombatGroup: (groupIndex: number) => void;
    reorderUnit: (groupIndex: number, fromIndex: number, toIndex: number) => void;
    moveUnitToGroup: (fromGroupIndex: number, toGroupIndex: number, unitId: string, toIndex?: number) => void;
    updateListName: (name: string) => void;
    updatePointsLimit: (pointsLimit: number) => void;
    resetList: () => void;
}

// ============================================================================
// Dispatch helper — delegates to the existing pure reducer
// ============================================================================

function dispatch(state: ListState, action: ListAction): Partial<ListStore> {
    const next = listReducer(state, action);
    return { currentList: next.currentList };
}

// ============================================================================
// Store
// ============================================================================

export const useListStore = create<ListStore>()(
    persist(
        (set) => ({
            // Initial state
            ...initialState,

            // Actions
            createList: (factionId, factionName, pointsLimit, name) =>
                set(s => dispatch(s, { type: 'CREATE_LIST', factionId, factionName, pointsLimit, name })),

            addUnit: (unit, groupIndex, profileGroupId, profileId, optionId) =>
                set(s => dispatch(s, { type: 'ADD_UNIT', unit, groupIndex, profileGroupId, profileId, optionId })),

            removeUnit: (groupIndex, unitId) =>
                set(s => dispatch(s, { type: 'REMOVE_UNIT', groupIndex, unitId })),

            addCombatGroup: () =>
                set(s => dispatch(s, { type: 'ADD_COMBAT_GROUP' })),

            removeCombatGroup: (groupIndex) =>
                set(s => dispatch(s, { type: 'REMOVE_COMBAT_GROUP', groupIndex })),

            reorderUnit: (groupIndex, fromIndex, toIndex) =>
                set(s => dispatch(s, { type: 'REORDER_UNIT', groupIndex, fromIndex, toIndex })),

            moveUnitToGroup: (fromGroupIndex, toGroupIndex, unitId, toIndex) =>
                set(s => dispatch(s, { type: 'MOVE_UNIT_TO_GROUP', fromGroupIndex, toGroupIndex, unitId, toIndex })),

            updateListName: (name) =>
                set(s => dispatch(s, { type: 'UPDATE_LIST_NAME', name })),

            updatePointsLimit: (pointsLimit) =>
                set(s => dispatch(s, { type: 'UPDATE_POINTS_LIMIT', pointsLimit })),

            resetList: () =>
                set(s => dispatch(s, { type: 'RESET_LIST' })),
        }),
        {
            name: 'infinity-list-state',
        }
    )
);


