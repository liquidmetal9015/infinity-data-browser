// Army list building logic - platform-agnostic reducer pattern
// Used by both frontend React context and MCP server

import type { Unit } from './types.js';
import type { ArmyList, CombatGroup, ListUnit } from './listTypes.js';
import { generateId, getUnitDetails } from './listTypes.js';

// ============================================================================
// State & Actions
// ============================================================================

export interface ListState {
    /** The current active army list, or null if none */
    currentList: ArmyList | null;
}

export type ListAction =
    | { type: 'CREATE_LIST'; factionId: number; factionName: string; pointsLimit?: number; name?: string }
    | { type: 'ADD_UNIT'; unit: Unit; groupIndex: number; profileGroupId: number; profileId: number; optionId: number }
    | { type: 'REMOVE_UNIT'; groupIndex: number; unitId: string }
    | { type: 'REORDER_UNIT'; groupIndex: number; fromIndex: number; toIndex: number }
    | { type: 'MOVE_UNIT_TO_GROUP'; fromGroupIndex: number; toGroupIndex: number; unitId: string; toIndex?: number }
    | { type: 'ADD_COMBAT_GROUP' }
    | { type: 'REMOVE_COMBAT_GROUP'; groupIndex: number }
    | { type: 'UPDATE_LIST_NAME'; name: string }
    | { type: 'UPDATE_POINTS_LIMIT'; pointsLimit: number }
    | { type: 'ASSIGN_TO_FIRETEAM'; groupIndex: number; unitIds: string[]; fireteamId: string; color: string; notes?: string }
    | { type: 'REMOVE_FROM_FIRETEAM'; groupIndex: number; unitIds: string[] }
    | { type: 'CLEAR_FIRETEAM'; groupIndex: number; fireteamId: string }
    | { type: 'ADD_FIRETEAM_DEF'; groupIndex: number; id: string; color: string; notes?: string; selectedTeamName?: string; selectedTeamType?: string }
    | { type: 'UPDATE_FIRETEAM_DEF'; groupIndex: number; fireteamId: string; updates: Partial<import('./listTypes.js').FireteamDef> }
    | { type: 'REMOVE_FIRETEAM_DEF'; groupIndex: number; fireteamId: string }
    | { type: 'MOVE_FIRETEAM'; fromGroupIndex: number; toGroupIndex: number; fireteamId: string; toIndex?: number }
    | { type: 'RESET_LIST' }
    | { type: 'LOAD_LIST'; list: ArmyList }
    | { type: 'SET_SERVER_ID'; serverId: number }
    | { type: 'UPDATE_NOTES'; notes: string }
    | { type: 'UPDATE_TAGS'; tags: string[] }
    | { type: 'UPDATE_LOCK'; isLocked: boolean }
    | { type: 'UPDATE_RATING'; rating: number };

export const initialState: ListState = {
    currentList: null,
};

// ============================================================================
// Reducer helpers
// ============================================================================

/** Immutably update a single combat group by index, returning new state.
 *  Returns unchanged state if currentList is null or groupIndex is out of bounds. */
function withGroup(
    state: ListState,
    groupIndex: number,
    fn: (group: CombatGroup) => CombatGroup
): ListState {
    if (!state.currentList) return state;
    const { groups } = state.currentList;
    if (groupIndex < 0 || groupIndex >= groups.length) return state;
    const newGroups = [...groups];
    newGroups[groupIndex] = fn(groups[groupIndex]);
    return {
        ...state,
        currentList: { ...state.currentList, groups: newGroups, updatedAt: Date.now() },
    };
}

// ============================================================================
// Reducer
// ============================================================================

// Actions that mutate list contents/structure — blocked while the list is locked.
// Excludes navigation/lifecycle (LOAD/RESET/CREATE/SET_SERVER_ID), the lock
// toggle itself, and metadata (rating/tags/notes/name) which the UI gates
// independently.
const STRUCTURAL_ACTIONS = new Set<ListAction['type']>([
    'ADD_UNIT', 'REMOVE_UNIT', 'REORDER_UNIT', 'MOVE_UNIT_TO_GROUP',
    'ADD_COMBAT_GROUP', 'REMOVE_COMBAT_GROUP',
    'ASSIGN_TO_FIRETEAM', 'REMOVE_FROM_FIRETEAM', 'CLEAR_FIRETEAM',
    'ADD_FIRETEAM_DEF', 'UPDATE_FIRETEAM_DEF', 'REMOVE_FIRETEAM_DEF', 'MOVE_FIRETEAM',
    'UPDATE_POINTS_LIMIT',
]);

export function listReducer(state: ListState, action: ListAction): ListState {
    if (state.currentList?.isLocked && STRUCTURAL_ACTIONS.has(action.type)) {
        return state;
    }
    switch (action.type) {
        case 'CREATE_LIST': {
            const pointsLimit = action.pointsLimit || 300;
            const newList: ArmyList = {
                id: generateId(),
                name: action.name || `New ${action.factionName} List`,
                factionId: action.factionId,
                pointsLimit,
                swcLimit: pointsLimit / 50,
                tags: [],
                groups: [
                    {
                        id: generateId(),
                        name: 'Combat Group 1',
                        units: [],
                        fireteams: [],
                    },
                ],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            return { ...state, currentList: newList };
        }

        case 'ADD_UNIT': {
            if (!state.currentList) return state;

            const { unit, groupIndex, profileGroupId, profileId, optionId } = action;

            if (!unit.factions.includes(state.currentList.factionId)) {
                console.warn('Rejected out-of-faction unit', unit.isc, 'for faction', state.currentList.factionId);
                return state;
            }

            const { option } = getUnitDetails(unit, profileGroupId, profileId, optionId);

            if (!option) {
                console.warn('Could not find option for unit', unit.isc, optionId);
                return state;
            }

            const newUnit: ListUnit = {
                id: generateId(),
                unitId: unit.id,
                unit,
                profileGroupId,
                profileId,
                optionId,
                points: Number(option.points || 0),
                swc: Number(option.swc || 0),
            };

            // Auto-attach peripheral units specified by this loadout's includes array.
            // Each entry in option.includes is a { q, group, option } reference where
            // group is a 1-based profile group index and option is a 1-based option index.
            // This is the authoritative source — units with no includes (e.g. FTO-only
            // Order Sergeants) get no peripherals, while Drummers get exactly the right
            // Drumbots for the chosen loadout (including multiple when q>1 or there are
            // multiple include entries).
            const peripherals: ListUnit[] = [];
            for (const inc of (option.includes || [])) {
                const pg = unit.raw.profileGroups[inc.group - 1];
                if (!pg?.isAutoAttached) continue;
                const pProfile = pg.profiles?.[0];
                const pOption = pg.options?.[inc.option - 1];
                if (!pProfile || !pOption) continue;
                for (let q = 0; q < (inc.q || 1); q++) {
                    peripherals.push({
                        id: generateId(),
                        unitId: unit.id,
                        unit,
                        profileGroupId: pg.id,
                        profileId: pProfile.id,
                        optionId: pOption.id,
                        points: Number(pOption.points || 0),
                        swc: Number(pOption.swc || 0),
                        parentId: newUnit.id,
                        isPeripheral: true,
                    });
                }
            }

            return withGroup(state, groupIndex, g => ({
                ...g,
                units: [...g.units, newUnit, ...peripherals]
            }));
        }

        case 'REMOVE_UNIT': {
            if (!state.currentList) return state;
            const { groupIndex, unitId } = action;
            // Also remove any peripheral children attached to this unit
            return withGroup(state, groupIndex, g => ({
                ...g,
                units: g.units.filter(u => u.id !== unitId && u.parentId !== unitId)
            }));
        }

        case 'REORDER_UNIT': {
            if (!state.currentList) return state;
            const { groupIndex, fromIndex, toIndex } = action;
            return withGroup(state, groupIndex, g => {
                const units = [...g.units];
                const [removed] = units.splice(fromIndex, 1);
                units.splice(toIndex, 0, removed);
                return { ...g, units };
            });
        }

        case 'MOVE_UNIT_TO_GROUP': {
            if (!state.currentList) return state;

            const { fromGroupIndex, toGroupIndex, unitId, toIndex } = action;
            const newGroups = [...state.currentList.groups];

            // Find and remove from source group (including peripherals)
            const sourceUnits = [...newGroups[fromGroupIndex].units];
            const unitIndex = sourceUnits.findIndex(u => u.id === unitId);
            if (unitIndex === -1) return state;

            const [movedUnit] = sourceUnits.splice(unitIndex, 1);
            // Also extract any peripheral children
            const peripherals = sourceUnits.filter(u => u.parentId === unitId);
            const remainingSource = sourceUnits.filter(u => u.parentId !== unitId);
            newGroups[fromGroupIndex] = { ...newGroups[fromGroupIndex], units: remainingSource };

            // Add to target group
            const targetUnits = [...newGroups[toGroupIndex].units];
            const insertIndex = toIndex !== undefined ? toIndex : targetUnits.length;
            targetUnits.splice(insertIndex, 0, movedUnit, ...peripherals);
            newGroups[toGroupIndex] = { ...newGroups[toGroupIndex], units: targetUnits };

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'ADD_COMBAT_GROUP': {
            if (!state.currentList) return state;

            const newGroup: CombatGroup = {
                id: generateId(),
                name: `Combat Group ${state.currentList.groups.length + 1}`,
                units: [],
                fireteams: [],
            };

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: [...state.currentList.groups, newGroup],
                    updatedAt: Date.now(),
                },
            };
        }

        case 'REMOVE_COMBAT_GROUP': {
            if (!state.currentList) return state;
            if (state.currentList.groups.length <= 1) return state;

            const renamedGroups = state.currentList.groups
                .filter((_, i) => i !== action.groupIndex)
                .map((g, i) => ({ ...g, name: `Combat Group ${i + 1}` }));

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: renamedGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'UPDATE_LIST_NAME': {
            if (!state.currentList) return state;
            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    name: action.name,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'UPDATE_POINTS_LIMIT': {
            if (!state.currentList) return state;
            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    pointsLimit: action.pointsLimit,
                    swcLimit: action.pointsLimit / 50,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'ADD_FIRETEAM_DEF': {
            if (!state.currentList) return state;
            const { groupIndex, id, color, notes, selectedTeamName, selectedTeamType } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                fireteams: [...(g.fireteams || []), { id, color, notes, selectedTeamName, selectedTeamType }],
            }));
        }

        case 'UPDATE_FIRETEAM_DEF': {
            if (!state.currentList) return state;
            const { groupIndex, fireteamId, updates } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                fireteams: (g.fireteams || []).map(ft => ft.id === fireteamId ? { ...ft, ...updates } : ft),
            }));
        }

        case 'REMOVE_FIRETEAM_DEF': {
            if (!state.currentList) return state;
            const { groupIndex, fireteamId } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                fireteams: (g.fireteams || []).filter(ft => ft.id !== fireteamId),
                // Remove the definition and also strip the id from units
                units: g.units.map(u => {
                    if (u.fireteamId === fireteamId) {
                        const { fireteamId: _fid, fireteamColor: _fc, fireteamNotes: _fn, ...rest } = u;
                        return rest as ListUnit;
                    }
                    return u;
                }),
            }));
        }

        case 'MOVE_FIRETEAM': {
            if (!state.currentList) return state;

            const { fromGroupIndex, toGroupIndex, fireteamId, toIndex } = action;
            const newGroups = [...state.currentList.groups];

            // Get source group
            if (fromGroupIndex < 0 || fromGroupIndex >= newGroups.length) return state;

            // Extract the fireteam def (immutable)
            const sourceGroup = newGroups[fromGroupIndex];
            const sourceFts = [...(sourceGroup.fireteams || [])];
            const ftDefIndex = sourceFts.findIndex(ft => ft.id === fireteamId);
            if (ftDefIndex === -1) return state;

            const [ftDef] = sourceFts.splice(ftDefIndex, 1);
            const ftUnits = sourceGroup.units.filter(u => u.fireteamId === fireteamId);

            newGroups[fromGroupIndex] = {
                ...sourceGroup,
                fireteams: sourceFts,
                units: sourceGroup.units.filter(u => u.fireteamId !== fireteamId),
            };

            // Insert into target group
            if (toGroupIndex < 0 || toGroupIndex >= newGroups.length) return state;
            const targetGroup = newGroups[toGroupIndex];
            const targetFts = fromGroupIndex === toGroupIndex
                ? newGroups[toGroupIndex].fireteams! // already a new array from above
                : [...(targetGroup.fireteams || [])];

            const insertIndex = toIndex !== undefined ? toIndex : targetFts.length;
            targetFts.splice(insertIndex, 0, ftDef);

            newGroups[toGroupIndex] = {
                ...newGroups[toGroupIndex],
                fireteams: targetFts,
                units: [...newGroups[toGroupIndex].units, ...ftUnits],
            };

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'ASSIGN_TO_FIRETEAM': {
            if (!state.currentList) return state;
            const { groupIndex, unitIds, fireteamId, color, notes } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                units: g.units.map(u =>
                    unitIds.includes(u.id) ? { ...u, fireteamId, fireteamColor: color, fireteamNotes: notes } : u
                ),
            }));
        }

        case 'REMOVE_FROM_FIRETEAM': {
            if (!state.currentList) return state;
            const { groupIndex, unitIds } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                units: g.units.map(u => {
                    if (!unitIds.includes(u.id)) return u;
                    const { fireteamId: _fid, fireteamColor: _fc, fireteamNotes: _fn, ...rest } = u;
                    return rest as ListUnit;
                }),
            }));
        }

        case 'CLEAR_FIRETEAM': {
            if (!state.currentList) return state;
            const { groupIndex, fireteamId } = action;
            return withGroup(state, groupIndex, g => ({
                ...g,
                units: g.units.map(u => {
                    if (u.fireteamId !== fireteamId) return u;
                    const { fireteamId: _fid, fireteamColor: _fc, fireteamNotes: _fn, ...rest } = u;
                    return rest as ListUnit;
                }),
            }));
        }

        case 'RESET_LIST': {
            return { ...state, currentList: null };
        }

        case 'LOAD_LIST': {
            return { ...state, currentList: action.list };
        }

        case 'SET_SERVER_ID': {
            if (!state.currentList) return state;
            return { ...state, currentList: { ...state.currentList, serverId: action.serverId } };
        }

        case 'UPDATE_NOTES': {
            if (!state.currentList) return state;
            return { ...state, currentList: { ...state.currentList, notes: action.notes, updatedAt: Date.now() } };
        }

        case 'UPDATE_TAGS': {
            if (!state.currentList) return state;
            return { ...state, currentList: { ...state.currentList, tags: action.tags, updatedAt: Date.now() } };
        }

        case 'UPDATE_LOCK': {
            if (!state.currentList) return state;
            return { ...state, currentList: { ...state.currentList, isLocked: action.isLocked, updatedAt: Date.now() } };
        }

        case 'UPDATE_RATING': {
            if (!state.currentList) return state;
            return { ...state, currentList: { ...state.currentList, rating: action.rating, updatedAt: Date.now() } };
        }

        default:
            return state;
    }
}
