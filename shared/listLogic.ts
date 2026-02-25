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
    | { type: 'ADD_FIRETEAM_DEF'; groupIndex: number; id: string; color: string; notes?: string }
    | { type: 'REMOVE_FIRETEAM_DEF'; groupIndex: number; fireteamId: string }
    | { type: 'MOVE_FIRETEAM'; fromGroupIndex: number; toGroupIndex: number; fireteamId: string; toIndex?: number }
    | { type: 'RESET_LIST' };

export const initialState: ListState = {
    currentList: null,
};

// ============================================================================
// Reducer
// ============================================================================

export function listReducer(state: ListState, action: ListAction): ListState {
    switch (action.type) {
        case 'CREATE_LIST': {
            const pointsLimit = action.pointsLimit || 300;
            const newList: ArmyList = {
                id: generateId(),
                name: action.name || `New ${action.factionName} List`,
                factionId: action.factionId,
                pointsLimit,
                swcLimit: pointsLimit / 50,
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
            const { option } = getUnitDetails(unit, profileGroupId, profileId, optionId);

            if (!option) {
                console.warn('Could not find option for unit', unit.isc, optionId);
                return state;
            }

            const newUnit: ListUnit = {
                id: generateId(),
                unit,
                profileGroupId,
                profileId,
                optionId,
                points: Number(option.points || 0),
                swc: Number(option.swc || 0),
            };

            const newGroups = [...state.currentList.groups];
            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                newGroups[groupIndex] = {
                    ...newGroups[groupIndex],
                    units: [...newGroups[groupIndex].units, newUnit],
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'REMOVE_UNIT': {
            if (!state.currentList) return state;

            const { groupIndex, unitId } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                newGroups[groupIndex] = {
                    ...newGroups[groupIndex],
                    units: newGroups[groupIndex].units.filter(u => u.id !== unitId),
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'REORDER_UNIT': {
            if (!state.currentList) return state;

            const { groupIndex, fromIndex, toIndex } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                const units = [...newGroups[groupIndex].units];
                const [removed] = units.splice(fromIndex, 1);
                units.splice(toIndex, 0, removed);
                newGroups[groupIndex] = { ...newGroups[groupIndex], units };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'MOVE_UNIT_TO_GROUP': {
            if (!state.currentList) return state;

            const { fromGroupIndex, toGroupIndex, unitId, toIndex } = action;
            const newGroups = [...state.currentList.groups];

            // Find and remove from source group
            const sourceUnits = [...newGroups[fromGroupIndex].units];
            const unitIndex = sourceUnits.findIndex(u => u.id === unitId);
            if (unitIndex === -1) return state;

            const [movedUnit] = sourceUnits.splice(unitIndex, 1);
            newGroups[fromGroupIndex] = { ...newGroups[fromGroupIndex], units: sourceUnits };

            // Add to target group
            const targetUnits = [...newGroups[toGroupIndex].units];
            const insertIndex = toIndex !== undefined ? toIndex : targetUnits.length;
            targetUnits.splice(insertIndex, 0, movedUnit);
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

            const newGroups = state.currentList.groups.filter((_, i) => i !== action.groupIndex);
            newGroups.forEach((g, i) => {
                g.name = `Combat Group ${i + 1}`;
            });

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
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

            const { groupIndex, id, color, notes } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                const group = newGroups[groupIndex];
                newGroups[groupIndex] = {
                    ...group,
                    fireteams: [...(group.fireteams || []), { id, color, notes }],
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'REMOVE_FIRETEAM_DEF': {
            if (!state.currentList) return state;

            const { groupIndex, fireteamId } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                const group = newGroups[groupIndex];

                // Remove the definition and also strip the id from units
                newGroups[groupIndex] = {
                    ...group,
                    fireteams: (group.fireteams || []).filter(ft => ft.id !== fireteamId),
                    units: group.units.map(u => {
                        if (u.fireteamId === fireteamId) {
                            const { fireteamId: _fid, fireteamColor: _fc, fireteamNotes: _fn, ...rest } = u;
                            return rest as ListUnit;
                        }
                        return u;
                    }),
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'MOVE_FIRETEAM': {
            if (!state.currentList) return state;

            const { fromGroupIndex, toGroupIndex, fireteamId, toIndex } = action;
            const newGroups = [...state.currentList.groups];

            // Get source group
            if (fromGroupIndex < 0 || fromGroupIndex >= newGroups.length) return state;

            // Extract the fireteam def
            const sourceGroup = newGroups[fromGroupIndex];
            const ftDefIndex = (sourceGroup.fireteams || []).findIndex(ft => ft.id === fireteamId);
            if (ftDefIndex === -1) return state;

            const [ftDef] = sourceGroup.fireteams!.splice(ftDefIndex, 1);

            // Extract all units belonging to the fireteam
            const ftUnits = sourceGroup.units.filter(u => u.fireteamId === fireteamId);
            sourceGroup.units = sourceGroup.units.filter(u => u.fireteamId !== fireteamId);

            newGroups[fromGroupIndex] = { ...sourceGroup };

            // Insert into target group
            if (toGroupIndex < 0 || toGroupIndex >= newGroups.length) return state;
            const targetGroup = newGroups[toGroupIndex];

            targetGroup.fireteams = [...(targetGroup.fireteams || [])];

            // Insert the definition
            // To maintain visual ordering of fireteam blocks, we could insert the def at a specific index,
            // but the `units` array order is what dnd-kit uses for absolute positional tracking of elements
            // Actually, since Fireteam Cards are mapped out based on `fireteams` order before standalone units,
            // we should reorder the `fireteams` array itself if moving within the same group, or append if moving groups

            if (fromGroupIndex === toGroupIndex) {
                // Reordering within the same group
                const insertIndex = toIndex !== undefined ? toIndex : targetGroup.fireteams.length;
                targetGroup.fireteams.splice(insertIndex, 0, ftDef);

                // We don't necessarily need to change `units` array order since they render mapped through the `fireteams` array
                targetGroup.units = [...targetGroup.units, ...ftUnits];
            } else {
                // Moving to a new group entirely
                const insertIndex = toIndex !== undefined ? toIndex : targetGroup.fireteams.length;
                targetGroup.fireteams.splice(insertIndex, 0, ftDef);
                targetGroup.units = [...targetGroup.units, ...ftUnits];
            }

            newGroups[toGroupIndex] = { ...targetGroup };

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
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                newGroups[groupIndex] = {
                    ...newGroups[groupIndex],
                    units: newGroups[groupIndex].units.map((u) =>
                        unitIds.includes(u.id)
                            ? { ...u, fireteamId, fireteamColor: color, fireteamNotes: notes }
                            : u
                    ),
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'REMOVE_FROM_FIRETEAM': {
            if (!state.currentList) return state;

            const { groupIndex, unitIds } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                newGroups[groupIndex] = {
                    ...newGroups[groupIndex],
                    units: newGroups[groupIndex].units.map((u) => {
                        if (unitIds.includes(u.id)) {
                            const { fireteamId, fireteamColor, fireteamNotes, ...rest } = u;
                            return rest as ListUnit;
                        }
                        return u;
                    }),
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'CLEAR_FIRETEAM': {
            if (!state.currentList) return state;

            const { groupIndex, fireteamId } = action;
            const newGroups = [...state.currentList.groups];

            if (groupIndex >= 0 && groupIndex < newGroups.length) {
                newGroups[groupIndex] = {
                    ...newGroups[groupIndex],
                    units: newGroups[groupIndex].units.map((u) => {
                        if (u.fireteamId === fireteamId) {
                            const { fireteamId: _fid, fireteamColor: _fc, fireteamNotes: _fn, ...rest } = u;
                            return rest as ListUnit;
                        }
                        return u;
                    }),
                };
            }

            return {
                ...state,
                currentList: {
                    ...state.currentList,
                    groups: newGroups,
                    updatedAt: Date.now(),
                },
            };
        }

        case 'RESET_LIST': {
            return { ...state, currentList: null };
        }

        default:
            return state;
    }
}
