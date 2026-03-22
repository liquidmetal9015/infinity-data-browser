// Tests for the Zustand list store
import { describe, it, expect, beforeEach } from 'vitest';
import { useListStore } from './useListStore';
import type { Unit } from '@shared/types';

// ============================================================================
// Helpers
// ============================================================================

function createMockUnit(overrides: Partial<Unit> = {}): Unit {
    return {
        id: 1,
        idArmy: 101,
        isc: 'Fusilier',
        name: 'Fusilier',
        slug: 'fusilier',
        factions: [1],
        allWeaponIds: new Set<number>(),
        allSkillIds: new Set<number>(),
        allEquipmentIds: new Set<number>(),
        raw: {
            id: 1,
            idArmy: 101,
            isc: 'Fusilier',
            name: 'Fusilier',
            slug: 'fusilier',
            factions: [1],
            profileGroups: [{
                id: 1,
                profiles: [{
                    id: 1,
                    name: 'Fusilier',
                    mov: '4-4',
                    cc: 13,
                    bs: 12,
                    ph: 10,
                    wip: 12,
                    arm: 1,
                    bts: 0,
                    w: 1,
                    s: 2,
                    structure: false,
                    skills: [],
                    weapons: [],
                    equipment: [],
                }],
                options: [{
                    id: 1,
                    name: 'Combi Rifle',
                    points: 10,
                    swc: 0,
                    weapons: [],
                    skills: [],
                    equipment: [],
                }],
            }],
        },
        ...overrides,
    } as Unit;
}

// ============================================================================
// Tests
// ============================================================================

describe('useListStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        useListStore.setState({ currentList: null });
    });

    describe('createList', () => {
        it('creates a new list with correct faction and defaults', () => {
            useListStore.getState().createList(1, 'PanOceania', 300, 'My List');

            const { currentList } = useListStore.getState();
            expect(currentList).not.toBeNull();
            expect(currentList!.factionId).toBe(1);
            expect(currentList!.pointsLimit).toBe(300);
            expect(currentList!.name).toBe('My List');
            expect(currentList!.groups).toHaveLength(1);
        });
    });

    describe('addUnit', () => {
        it('adds a unit to the specified combat group', () => {
            const store = useListStore.getState();
            store.createList(1, 'PanOceania', 300);

            const unit = createMockUnit();
            useListStore.getState().addUnit(unit, 0, 1, 1, 1);

            const { currentList } = useListStore.getState();
            expect(currentList!.groups[0].units).toHaveLength(1);
            expect(currentList!.groups[0].units[0].points).toBe(10);
        });
    });

    describe('removeUnit', () => {
        it('removes a unit from the specified combat group', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            useListStore.getState().addUnit(createMockUnit(), 0, 1, 1, 1);

            const unitId = useListStore.getState().currentList!.groups[0].units[0].id;
            useListStore.getState().removeUnit(0, unitId);

            expect(useListStore.getState().currentList!.groups[0].units).toHaveLength(0);
        });
    });

    describe('resetList', () => {
        it('clears the current list', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            expect(useListStore.getState().currentList).not.toBeNull();

            useListStore.getState().resetList();
            expect(useListStore.getState().currentList).toBeNull();
        });
    });

    describe('addCombatGroup', () => {
        it('adds a new combat group', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            useListStore.getState().addCombatGroup();

            expect(useListStore.getState().currentList!.groups).toHaveLength(2);
        });
    });

    describe('updateListName', () => {
        it('updates the list name', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            useListStore.getState().updateListName('Tournament List');

            expect(useListStore.getState().currentList!.name).toBe('Tournament List');
        });
    });

    describe('updatePointsLimit', () => {
        it('updates points limit and recalculates SWC limit', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            useListStore.getState().updatePointsLimit(400);

            const { currentList } = useListStore.getState();
            expect(currentList!.pointsLimit).toBe(400);
            expect(currentList!.swcLimit).toBe(8); // 400/50
        });
    });

    describe('state persistence shape', () => {
        it('state is serializable (no functions or Sets in persisted state)', () => {
            useListStore.getState().createList(1, 'PanOceania', 300);
            useListStore.getState().addUnit(createMockUnit(), 0, 1, 1, 1);

            const state = useListStore.getState();
            // Should not throw when stringified
            const json = JSON.stringify({ currentList: state.currentList });
            expect(json).toBeTruthy();

            // Should round-trip
            const parsed = JSON.parse(json);
            expect(parsed.currentList.factionId).toBe(1);
            expect(parsed.currentList.groups[0].units).toHaveLength(1);
        });
    });
});
