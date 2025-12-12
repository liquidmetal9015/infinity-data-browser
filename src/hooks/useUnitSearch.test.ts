import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnitSearch } from './useUnitSearch';
import type { IDatabase } from '../services/Database';
import type { Unit } from '../types';

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
        raw: {} as any
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
        raw: {} as any
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
});
