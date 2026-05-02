// Zustand store for army list state
// Replaces ListContext with a global store that persists to localStorage
// and shares state between workspace windows and full-screen pages.

import { create } from 'zustand';
import { persist, type StorageValue } from 'zustand/middleware';
import type { Unit } from '@shared/types';
import type { ArmyList } from '@shared/listTypes';
import { dehydrateList, hydrateList, type DehydratedArmyList } from '@shared/listTypes';
import { listReducer, initialState, type ListState, type ListAction } from '@shared/listLogic';
import { DatabaseImplementation } from '../services/Database';

// ============================================================================
// Store Interface
// ============================================================================

interface ListStore extends ListState {
    lastSavedAt: number | null;
    isDirty: boolean;
    recordSave: () => void;
    // Actions (same API as the old ListContext)
    createList: (factionId: number, factionName: string, pointsLimit?: number, name?: string) => void;
    addUnit: (unit: Unit, groupIndex: number, profileGroupId: number, profileId: number, optionId: number) => void;
    removeUnit: (groupIndex: number, unitId: string) => void;
    addCombatGroup: () => void;
    removeCombatGroup: (groupIndex: number) => void;
    reorderUnit: (groupIndex: number, fromIndex: number, toIndex: number) => void;
    moveUnitToGroup: (fromGroupIndex: number, toGroupIndex: number, unitId: string, toIndex?: number) => void;
    assignToFireteam: (groupIndex: number, unitIds: string[], fireteamId: string, color: string, notes?: string) => void;
    removeFromFireteam: (groupIndex: number, unitIds: string[]) => void;
    clearFireteam: (groupIndex: number, fireteamId: string) => void;
    addFireteamDef: (groupIndex: number, id: string, color: string, notes?: string, selectedTeamName?: string, selectedTeamType?: string) => void;
    updateFireteamDef: (groupIndex: number, fireteamId: string, updates: Partial<import('../../shared/listTypes.js').FireteamDef>) => void;
    removeFireteamDef: (groupIndex: number, fireteamId: string) => void;
    moveFireteam: (fromGroupIndex: number, toGroupIndex: number, fireteamId: string, toIndex?: number) => void;
    updateListName: (name: string) => void;
    updatePointsLimit: (pointsLimit: number) => void;
    updateDescription: (description: string) => void;
    updateTags: (tags: string[]) => void;
    resetList: () => void;
    loadList: (list: ArmyList) => void;
    setServerId: (serverId: number) => void;
}

// ============================================================================
// Dispatch helper — delegates to the existing pure reducer
// ============================================================================

function dispatch(state: ListStore, action: ListAction): Partial<ListStore> {
    const next = listReducer(state, action);
    const isDirty = next.currentList !== null && next.currentList.updatedAt > (state.lastSavedAt ?? 0);
    return { currentList: next.currentList, isDirty };
}

// ============================================================================
// Store
// ============================================================================

export const useListStore = create<ListStore>()(
    persist(
        (set) => ({
            // Initial state
            ...initialState,
            lastSavedAt: null,
            isDirty: false,

            recordSave: () =>
                set(s => ({
                    lastSavedAt: s.currentList?.updatedAt ?? Date.now(),
                    isDirty: false,
                })),

            // Actions
            createList: (factionId, factionName, pointsLimit, name) =>
                set(s => ({
                    ...dispatch(s, { type: 'CREATE_LIST', factionId, factionName, pointsLimit, name }),
                    lastSavedAt: null,
                })),

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

            assignToFireteam: (groupIndex, unitIds, fireteamId, color, notes) =>
                set(s => dispatch(s, { type: 'ASSIGN_TO_FIRETEAM', groupIndex, unitIds, fireteamId, color, notes })),

            removeFromFireteam: (groupIndex, unitIds) =>
                set(s => dispatch(s, { type: 'REMOVE_FROM_FIRETEAM', groupIndex, unitIds })),

            clearFireteam: (groupIndex, fireteamId) =>
                set(s => dispatch(s, { type: 'CLEAR_FIRETEAM', groupIndex, fireteamId })),

            addFireteamDef: (groupIndex, id, color, notes, selectedTeamName, selectedTeamType) =>
                set(s => dispatch(s, { type: 'ADD_FIRETEAM_DEF', groupIndex, id, color, notes, selectedTeamName, selectedTeamType })),

            updateFireteamDef: (groupIndex, fireteamId, updates) =>
                set(s => dispatch(s, { type: 'UPDATE_FIRETEAM_DEF', groupIndex, fireteamId, updates })),

            removeFireteamDef: (groupIndex, fireteamId) =>
                set(s => dispatch(s, { type: 'REMOVE_FIRETEAM_DEF', groupIndex, fireteamId })),

            moveFireteam: (fromGroupIndex, toGroupIndex, fireteamId, toIndex) =>
                set(s => dispatch(s, { type: 'MOVE_FIRETEAM', fromGroupIndex, toGroupIndex, fireteamId, toIndex })),

            updateListName: (name) =>
                set(s => dispatch(s, { type: 'UPDATE_LIST_NAME', name })),

            updatePointsLimit: (pointsLimit) =>
                set(s => dispatch(s, { type: 'UPDATE_POINTS_LIMIT', pointsLimit })),

            updateDescription: (description) =>
                set(s => dispatch(s, { type: 'UPDATE_DESCRIPTION', description })),

            updateTags: (tags) =>
                set(s => dispatch(s, { type: 'UPDATE_TAGS', tags })),

            resetList: () =>
                set(s => ({
                    ...dispatch(s, { type: 'RESET_LIST' }),
                    lastSavedAt: null,
                    isDirty: false,
                })),

            loadList: (list) =>
                set(() => ({
                    currentList: list,
                    lastSavedAt: list.updatedAt,
                    isDirty: false,
                })),

            setServerId: (serverId) =>
                set(s => dispatch(s, { type: 'SET_SERVER_ID', serverId })),
        }),
        {
            name: 'infinity-list-state',
            partialize: (state) => ({
                currentList: state.currentList,
                lastSavedAt: state.lastSavedAt,
            }),
            storage: {
                getItem: (name) => {
                    const raw = localStorage.getItem(name);
                    if (!raw) return null;
                    const stored = JSON.parse(raw) as StorageValue<{ currentList: DehydratedArmyList | ArmyList | null; lastSavedAt: number | null }>;
                    if (!stored?.state?.currentList) return stored as StorageValue<{ currentList: ArmyList | null; lastSavedAt: number | null }>;

                    const list = stored.state.currentList;
                    // If the list already has resolved `unit` fields (legacy format), pass through
                    const firstUnit = list.groups?.[0]?.units?.[0];
                    if (firstUnit && 'unit' in firstUnit && (firstUnit as any).unit?.raw) {
                        return stored as StorageValue<{ currentList: ArmyList | null; lastSavedAt: number | null }>;
                    }

                    // Hydrate from database
                    const db = DatabaseImplementation.getInstance();
                    const hydrated = hydrateList(
                        list as DehydratedArmyList,
                        (id) => db.getUnitById(id),
                    );
                    return {
                        ...stored,
                        state: { ...stored.state, currentList: hydrated },
                    } as StorageValue<{ currentList: ArmyList | null; lastSavedAt: number | null }>;
                },
                setItem: (name, value) => {
                    const state = (value as StorageValue<{ currentList: ArmyList | null; lastSavedAt: number | null }>).state;
                    const toStore = {
                        ...value,
                        state: {
                            ...state,
                            currentList: state.currentList ? dehydrateList(state.currentList) : null,
                        },
                    };
                    localStorage.setItem(name, JSON.stringify(toStore));
                },
                removeItem: (name) => localStorage.removeItem(name),
            },
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                if (state.currentList) {
                    state.isDirty = state.currentList.updatedAt > (state.lastSavedAt ?? 0);
                }
            },
        }
    )
);


