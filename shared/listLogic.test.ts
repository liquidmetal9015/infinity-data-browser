// Tests for shared/listLogic.ts - Army list reducer logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listReducer, initialState, type ListState, type ListAction } from './listLogic';
import { calculateListPoints, calculateListSWC, getUnitDetails } from './listTypes';
import type { Unit } from './types';
import type { ProcessedUnit } from './game-model.js';

// Mock unit factory
function createMockUnit(overrides: Partial<ProcessedUnit> = {}): Unit {
    const raw: ProcessedUnit = {
        id: 1,
        isc: 'Test Unit',
        name: 'Test Unit',
        slug: 'test-unit',
        factionIds: [101],
        allWeaponIds: [],
        allSkillIds: [],
        allEquipmentIds: [],
        pointsRange: [25, 35],
        hasPeripherals: false,
        profileGroups: [
            {
                id: 1,
                isc: 'Test Unit',
                category: 1,
                isPeripheral: false,
                isAutoAttached: false,
                isFTO: false,
                profiles: [
                    {
                        id: 1,
                        name: 'Profile 1',
                        unitType: 1,
                        ava: 255,
                        characteristics: [],
                        skills: [],
                        equipment: [],
                        weapons: [],
                        move: [4, 4],
                        cc: 13,
                        bs: 12,
                        ph: 10,
                        wip: 14,
                        arm: 3,
                        bts: 0,
                        w: 1,
                        s: 2,
                        isStructure: false,
                    }
                ],
                options: [
                    { id: 1, name: 'Combi Rifle', points: 25, swc: 0, minis: 1, skills: [], equipment: [], weapons: [], orders: [] },
                    { id: 2, name: 'HMG', points: 35, swc: 1.5, minis: 1, skills: [], equipment: [], weapons: [], orders: [] },
                ]
            }
        ],
        ...overrides
    };

    return {
        id: raw.id,
        isc: raw.isc,
        name: raw.name,
        factions: raw.factionIds,
        allWeaponIds: new Set(),
        allSkillIds: new Set(),
        allEquipmentIds: new Set(),
        allItemsWithMods: [],
        pointsRange: [25, 35],
        raw,
    };
}

// Mock time for deterministic tests
let mockTimeValue = 1700000000000;

describe('listReducer', () => {
    beforeEach(() => {
        mockTimeValue = 1700000000000;
        vi.spyOn(Date, 'now').mockImplementation(() => mockTimeValue);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('CREATE_LIST', () => {
        it('creates a new list with default values', () => {
            const action: ListAction = {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'PanOceania'
            };

            const result = listReducer(initialState, action);

            expect(result.currentList).not.toBeNull();
            expect(result.currentList?.factionId).toBe(101);
            expect(result.currentList?.name).toBe('New PanOceania List');
            expect(result.currentList?.pointsLimit).toBe(300);
            expect(result.currentList?.swcLimit).toBe(6);
            expect(result.currentList?.groups).toHaveLength(1);
            expect(result.currentList?.groups[0].name).toBe('Combat Group 1');
            expect(result.currentList?.groups[0].units).toHaveLength(0);
        });

        it('creates a list with custom points limit', () => {
            const action: ListAction = {
                type: 'CREATE_LIST',
                factionId: 102,
                factionName: 'Yu Jing',
                pointsLimit: 400
            };

            const result = listReducer(initialState, action);

            expect(result.currentList?.pointsLimit).toBe(400);
            expect(result.currentList?.swcLimit).toBe(8);
        });

        it('creates a list with custom name', () => {
            const action: ListAction = {
                type: 'CREATE_LIST',
                factionId: 103,
                factionName: 'Ariadna',
                name: 'Tournament List'
            };

            const result = listReducer(initialState, action);

            expect(result.currentList?.name).toBe('Tournament List');
        });
    });

    describe('ADD_UNIT', () => {
        let stateWithList: ListState;

        beforeEach(() => {
            const createAction: ListAction = {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            };
            stateWithList = listReducer(initialState, createAction);
        });

        it('adds a unit to the specified combat group', () => {
            const unit = createMockUnit();
            const action: ListAction = {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 1
            };

            const result = listReducer(stateWithList, action);

            expect(result.currentList?.groups[0].units).toHaveLength(1);
            expect(result.currentList?.groups[0].units[0].points).toBe(25);
            expect(result.currentList?.groups[0].units[0].swc).toBe(0);
        });

        it('adds a unit with SWC cost', () => {
            const unit = createMockUnit();
            const action: ListAction = {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 2  // HMG option with 1.5 SWC
            };

            const result = listReducer(stateWithList, action);

            expect(result.currentList?.groups[0].units).toHaveLength(1);
            expect(result.currentList?.groups[0].units[0].points).toBe(35);
            expect(result.currentList?.groups[0].units[0].swc).toBe(1.5);
        });

        it('returns unchanged state if no list exists', () => {
            const unit = createMockUnit();
            const action: ListAction = {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 1
            };

            const result = listReducer(initialState, action);

            expect(result).toBe(initialState);
        });

        it('returns unchanged state if option not found', () => {
            const unit = createMockUnit();
            const action: ListAction = {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 999  // Non-existent option
            };

            const result = listReducer(stateWithList, action);

            expect(result.currentList?.groups[0].units).toHaveLength(0);
        });
    });

    describe('REMOVE_UNIT', () => {
        it('removes a unit from the specified group', () => {
            // Setup: Create list and add a unit
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const unit = createMockUnit();
            state = listReducer(state, {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 1
            });

            const unitId = state.currentList!.groups[0].units[0].id;

            // Test removal
            const result = listReducer(state, {
                type: 'REMOVE_UNIT',
                groupIndex: 0,
                unitId
            });

            expect(result.currentList?.groups[0].units).toHaveLength(0);
        });

        it('does nothing if unit ID not found', () => {
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const unit = createMockUnit();
            state = listReducer(state, {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 1
            });

            const result = listReducer(state, {
                type: 'REMOVE_UNIT',
                groupIndex: 0,
                unitId: 'non-existent-id'
            });

            expect(result.currentList?.groups[0].units).toHaveLength(1);
        });
    });

    describe('REORDER_UNIT', () => {
        it('reorders units within a combat group', () => {
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            // Add three units
            const unit1 = createMockUnit({ isc: 'Unit A' });
            const unit2 = createMockUnit({ isc: 'Unit B' });
            const unit3 = createMockUnit({ isc: 'Unit C' });

            state = listReducer(state, { type: 'ADD_UNIT', unit: unit1, groupIndex: 0, profileGroupId: 1, profileId: 1, optionId: 1 });
            state = listReducer(state, { type: 'ADD_UNIT', unit: unit2, groupIndex: 0, profileGroupId: 1, profileId: 1, optionId: 1 });
            state = listReducer(state, { type: 'ADD_UNIT', unit: unit3, groupIndex: 0, profileGroupId: 1, profileId: 1, optionId: 1 });

            // Move first unit to last position
            const result = listReducer(state, {
                type: 'REORDER_UNIT',
                groupIndex: 0,
                fromIndex: 0,
                toIndex: 2
            });

            expect(result.currentList?.groups[0].units[0].unit.isc).toBe('Unit B');
            expect(result.currentList?.groups[0].units[1].unit.isc).toBe('Unit C');
            expect(result.currentList?.groups[0].units[2].unit.isc).toBe('Unit A');
        });
    });

    describe('ADD_COMBAT_GROUP', () => {
        it('adds a new combat group', () => {
            const state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const result = listReducer(state, { type: 'ADD_COMBAT_GROUP' });

            expect(result.currentList?.groups).toHaveLength(2);
            expect(result.currentList?.groups[1].name).toBe('Combat Group 2');
            expect(result.currentList?.groups[1].units).toHaveLength(0);
        });
    });

    describe('REMOVE_COMBAT_GROUP', () => {
        it('removes a combat group and renumbers remaining', () => {
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });
            state = listReducer(state, { type: 'ADD_COMBAT_GROUP' });
            state = listReducer(state, { type: 'ADD_COMBAT_GROUP' });

            // Remove the second group
            const result = listReducer(state, {
                type: 'REMOVE_COMBAT_GROUP',
                groupIndex: 1
            });

            expect(result.currentList?.groups).toHaveLength(2);
            expect(result.currentList?.groups[0].name).toBe('Combat Group 1');
            expect(result.currentList?.groups[1].name).toBe('Combat Group 2');
        });

        it('does not remove the last combat group', () => {
            const state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const result = listReducer(state, {
                type: 'REMOVE_COMBAT_GROUP',
                groupIndex: 0
            });

            expect(result.currentList?.groups).toHaveLength(1);
        });

        it('does not mutate the original state groups', () => {
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });
            state = listReducer(state, { type: 'ADD_COMBAT_GROUP' });
            state = listReducer(state, { type: 'ADD_COMBAT_GROUP' });

            // Capture original group names
            const originalNames = state.currentList!.groups.map(g => g.name);

            // Remove the second group
            listReducer(state, {
                type: 'REMOVE_COMBAT_GROUP',
                groupIndex: 1
            });

            // Original state must NOT have been mutated
            const namesAfter = state.currentList!.groups.map(g => g.name);
            expect(namesAfter).toEqual(originalNames);
        });
    });

    describe('MOVE_UNIT_TO_GROUP', () => {
        it('moves a unit between combat groups', () => {
            let state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });
            state = listReducer(state, { type: 'ADD_COMBAT_GROUP' });

            const unit = createMockUnit();
            state = listReducer(state, {
                type: 'ADD_UNIT',
                unit,
                groupIndex: 0,
                profileGroupId: 1,
                profileId: 1,
                optionId: 1
            });

            const unitId = state.currentList!.groups[0].units[0].id;

            const result = listReducer(state, {
                type: 'MOVE_UNIT_TO_GROUP',
                fromGroupIndex: 0,
                toGroupIndex: 1,
                unitId
            });

            expect(result.currentList?.groups[0].units).toHaveLength(0);
            expect(result.currentList?.groups[1].units).toHaveLength(1);
        });
    });

    describe('UPDATE_LIST_NAME', () => {
        it('updates the list name', () => {
            const state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const result = listReducer(state, {
                type: 'UPDATE_LIST_NAME',
                name: 'My Tournament List'
            });

            expect(result.currentList?.name).toBe('My Tournament List');
        });
    });

    describe('UPDATE_POINTS_LIMIT', () => {
        it('updates points limit and recalculates SWC limit', () => {
            const state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const result = listReducer(state, {
                type: 'UPDATE_POINTS_LIMIT',
                pointsLimit: 400
            });

            expect(result.currentList?.pointsLimit).toBe(400);
            expect(result.currentList?.swcLimit).toBe(8);
        });
    });

    describe('RESET_LIST', () => {
        it('resets the current list to null', () => {
            const state = listReducer(initialState, {
                type: 'CREATE_LIST',
                factionId: 101,
                factionName: 'Test'
            });

            const result = listReducer(state, { type: 'RESET_LIST' });

            expect(result.currentList).toBeNull();
        });
    });
});

describe('listTypes helpers', () => {
    describe('calculateListPoints', () => {
        it('calculates total points across all groups', () => {
            const list = {
                id: '1',
                name: 'Test',
                tags: [],
                factionId: 101,
                pointsLimit: 300,
                swcLimit: 6,
                groups: [
                    {
                        id: 'g1',
                        name: 'Group 1',
                        units: [
                            { id: 'u1', unitId: 1, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 1, points: 25, swc: 0 },
                            { id: 'u2', unitId: 2, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 2, points: 35, swc: 1.5 },
                        ]
                    },
                    {
                        id: 'g2',
                        name: 'Group 2',
                        units: [
                            { id: 'u3', unitId: 3, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 1, points: 40, swc: 1 },
                        ]
                    }
                ],
                createdAt: 0,
                updatedAt: 0,
            };

            expect(calculateListPoints(list)).toBe(100);
        });
    });

    describe('calculateListSWC', () => {
        it('calculates total SWC across all groups', () => {
            const list = {
                id: '1',
                name: 'Test',
                tags: [],
                factionId: 101,
                pointsLimit: 300,
                swcLimit: 6,
                groups: [
                    {
                        id: 'g1',
                        name: 'Group 1',
                        units: [
                            { id: 'u1', unitId: 1, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 1, points: 25, swc: 0 },
                            { id: 'u2', unitId: 2, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 2, points: 35, swc: 1.5 },
                        ]
                    },
                    {
                        id: 'g2',
                        name: 'Group 2',
                        units: [
                            { id: 'u3', unitId: 3, unit: {} as Unit, profileGroupId: 1, profileId: 1, optionId: 1, points: 40, swc: 1 },
                        ]
                    }
                ],
                createdAt: 0,
                updatedAt: 0,
            };

            expect(calculateListSWC(list)).toBe(2.5);
        });
    });

    describe('getUnitDetails', () => {
        it('returns profile and option for valid IDs', () => {
            const unit = createMockUnit();
            const result = getUnitDetails(unit, 1, 1, 1);

            expect(result.profile).toBeDefined();
            expect(result.profile?.name).toBe('Profile 1');
            expect(result.option).toBeDefined();
            expect(result.option?.name).toBe('Combi Rifle');
        });

        it('returns undefined for invalid IDs', () => {
            const unit = createMockUnit();
            const result = getUnitDetails(unit, 999, 999, 999);

            expect(result.profile).toBeUndefined();
            expect(result.option).toBeUndefined();
        });
    });
});
