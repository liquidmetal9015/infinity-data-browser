import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnitSearch } from './useUnitSearch';
import type { IDatabase } from '../services/Database';
import type { Unit } from '../types';
import type { StatFilter } from '../components/QueryBuilder';

// Mock Database
const mockUnits: Unit[] = [
    {
        id: 1,
        isc: 'A',
        name: 'Unit A',
        factions: [1],
        allWeaponIds: new Set(),
        allSkillIds: new Set(),
        allEquipmentIds: new Set(),
        allItemsWithMods: [],
        pointsRange: [0, 0],
        raw: {
            profileGroups: [
                {
                    profiles: [
                        {
                            cc: 20,
                            bs: 10,
                            ph: 10,
                            wip: 10,
                            arm: 1,
                            bts: 0,
                            w: 1,
                            s: 2,
                            move: [10, 10] // 20cm = 8 inches
                        }
                    ],
                    options: []
                }
            ]
        } as any
    },
    {
        id: 2,
        isc: 'B',
        name: 'Unit B',
        factions: [2],
        allWeaponIds: new Set(),
        allSkillIds: new Set(),
        allEquipmentIds: new Set(),
        allItemsWithMods: [],
        pointsRange: [0, 0],
        raw: {
            profileGroups: [
                {
                    profiles: [
                        {
                            cc: 10,
                            bs: 15, // High BS
                            ph: 10,
                            wip: 14, // High WIP
                            arm: 1,
                            bts: 0,
                            w: 1,
                            s: 2,
                            move: [15, 10] // 25cm = 10 inches
                        }
                    ],
                    options: []
                }
            ]
        } as any
    }
];

const mockDb: IDatabase = {
    units: mockUnits,
    searchWithModifiers: vi.fn(),
    init: vi.fn(),
    metadata: null,
    getFactionName: () => '',
    getFactionShortName: () => '',
    getFactionInfo: () => undefined,
    getGroupedFactions: () => [],
    factionHasData: () => true,
    getSuggestions: () => [],
    extrasMap: new Map(),
    weaponMap: new Map(),
    skillMap: new Map(),
    equipmentMap: new Map(),
    getFireteamChart: vi.fn(() => undefined),
    getUnitBySlug: () => undefined,
    getWikiLink: vi.fn(),
    getExtraName: () => undefined
};

describe('useUnitSearch', () => {
    it('returns empty results when loading', () => {
        const { result } = renderHook(() => useUnitSearch(mockDb, true));
        expect(result.current.filteredUnits).toEqual([]);
    });

    it('applies query filters via database', () => {
        // Setup mock return
        (mockDb.searchWithModifiers as any).mockReturnValue([mockUnits[0]]);

        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        act(() => {
            result.current.setQuery({
                filters: [{
                    id: '1',
                    type: 'skill',
                    value: 'Test',
                    baseId: 1,
                    modifiers: [],
                    matchAnyModifier: false
                }],
                operator: 'or'
            });
        });

        expect(mockDb.searchWithModifiers).toHaveBeenCalled();
        expect(result.current.filteredUnits).toHaveLength(1);
        expect(result.current.filteredUnits[0].name).toBe('Unit A');
    });

    it('applies additional faction filters', () => {
        // Setup mock return to return both
        (mockDb.searchWithModifiers as any).mockReturnValue(mockUnits);

        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        // Set search to trigger results
        act(() => {
            result.current.setQuery({
                filters: [{ id: '1', type: 'skill', value: 'x', baseId: 1, modifiers: [], matchAnyModifier: false }],
                operator: 'or'
            });
        });

        // Set faction filter to match only Unit B (faction 2)
        act(() => {
            result.current.setFilters({ factions: [2] });
        });

        expect(result.current.filteredUnits).toHaveLength(1);
        expect(result.current.filteredUnits[0].name).toBe('Unit B');
    });

    it('filters by single stat (CC > 15)', () => {
        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        act(() => {
            result.current.setQuery({
                filters: [{
                    id: 's1',
                    type: 'stat',
                    stat: 'CC',
                    operator: '>',
                    value: 15
                } as StatFilter],
                operator: 'or'
            });
        });

        // Should return Unit A (CC 20)
        expect(result.current.filteredUnits).toHaveLength(1);
        expect(result.current.filteredUnits[0].name).toBe('Unit A');
    });

    it('filters by movement inches (MOV >= 10)', () => {
        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        act(() => {
            result.current.setQuery({
                filters: [{
                    id: 's2',
                    type: 'stat',
                    stat: 'MOV',
                    operator: '>=',
                    value: 10
                } as StatFilter],
                operator: 'or'
            });
        });

        // Unit A: 20cm = 8 inches. Unit B: 25cm = 10 inches.
        // Should match Unit B only.
        expect(result.current.filteredUnits).toHaveLength(1);
        expect(result.current.filteredUnits[0].name).toBe('Unit B');
    });

    it('combines item and stat filters with AND', () => {
        // Mock DB returns both for the item search
        (mockDb.searchWithModifiers as any).mockReturnValue(mockUnits);

        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        act(() => {
            result.current.setQuery({
                filters: [
                    { id: '1', type: 'skill', value: 'x', baseId: 1, modifiers: [], matchAnyModifier: false },
                    { id: 's1', type: 'stat', stat: 'BS', operator: '>', value: 12 } as StatFilter
                ],
                operator: 'and'
            });
        });

        // Only Unit B matches BS > 12
        expect(result.current.filteredUnits).toHaveLength(1);
        expect(result.current.filteredUnits[0].name).toBe('Unit B');
    });

    it('combines item and stat filters with OR', () => {
        // Mock DB returns Unit A for the item search
        (mockDb.searchWithModifiers as any).mockReturnValue([mockUnits[0]]);

        const { result } = renderHook(() => useUnitSearch(mockDb, false));

        act(() => {
            result.current.setQuery({
                filters: [
                    { id: '1', type: 'skill', value: 'x', baseId: 1, modifiers: [], matchAnyModifier: false },
                    { id: 's1', type: 'stat', stat: 'WIP', operator: '>', value: 13 } as StatFilter
                ],
                operator: 'or'
            });
        });

        // Unit A comes from item search.
        // Unit B matches WIP > 13 (WIP 14).
        // Result should be both.
        expect(result.current.filteredUnits).toHaveLength(2);

        const names = result.current.filteredUnits.map(u => u.name).sort();
        expect(names).toEqual(['Unit A', 'Unit B']);
    });
});
