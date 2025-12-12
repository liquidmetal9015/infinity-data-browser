import { describe, it, expect, beforeEach } from 'vitest';
import { FactionRegistry } from './factions';

// Mock faction data similar to what the app receives
const mockFactions = [
    { id: 1, parent: 1, name: 'PanOceania', slug: 'panoceania', discontinued: false, logo: '' },
    { id: 101, parent: 1, name: 'Military Orders', slug: 'military-orders', discontinued: false, logo: '' },
    { id: 102, parent: 1, name: 'Neoterran Capitaline Army', slug: 'neoterra', discontinued: false, logo: '' },
    { id: 2, parent: 2, name: 'Yu Jing', slug: 'yu-jing', discontinued: false, logo: '' },
    { id: 201, parent: 2, name: 'Imperial Service', slug: 'imperial-service', discontinued: false, logo: '' },
    { id: 10, parent: 10, name: 'Discontinued Faction', slug: 'discontinued', discontinued: true, logo: '' },
];

// Available slugs (simulating which JSON files exist)
const availableSlugs = ['panoceania', 'military-orders', 'neoterra', 'yu-jing'];

describe('FactionRegistry', () => {
    let registry: FactionRegistry;

    beforeEach(() => {
        registry = new FactionRegistry(mockFactions, availableSlugs);
    });

    describe('getFaction', () => {
        it('returns faction info for valid ID', () => {
            const faction = registry.getFaction(1);
            expect(faction).toBeDefined();
            expect(faction?.name).toBe('PanOceania');
            expect(faction?.isVanilla).toBe(true);
        });

        it('returns undefined for invalid ID', () => {
            const faction = registry.getFaction(9999);
            expect(faction).toBeUndefined();
        });
    });

    describe('getShortName', () => {
        it('returns short name for PanOceania', () => {
            expect(registry.getShortName(1)).toBe('PanO');
        });

        it('returns short name for Military Orders', () => {
            expect(registry.getShortName(101)).toBe('MO');
        });

        it('returns abbreviation for Neoterran Capitaline Army', () => {
            expect(registry.getShortName(102)).toBe('Neoterra');
        });

        it('returns "Unknown" for invalid ID', () => {
            expect(registry.getShortName(9999)).toBe('Unknown');
        });
    });

    describe('hasData', () => {
        it('returns true for factions with JSON files', () => {
            expect(registry.hasData(1)).toBe(true);
            expect(registry.hasData(101)).toBe(true);
        });

        it('returns false for factions without JSON files', () => {
            expect(registry.hasData(201)).toBe(false); // Imperial Service not in availableSlugs
        });
    });

    describe('getGroupedFactions', () => {
        it('returns grouped factions structure', () => {
            const grouped = registry.getGroupedFactions();
            expect(grouped.length).toBeGreaterThan(0);
        });

        it('contains PanOceania as a super-faction', () => {
            const grouped = registry.getGroupedFactions();
            const panO = grouped.find(g => g.name === 'PanOceania');
            expect(panO).toBeDefined();
        });

        it('groups sectorials under their parent', () => {
            const grouped = registry.getGroupedFactions();
            const panO = grouped.find(g => g.name === 'PanOceania');
            expect(panO?.sectorials.length).toBeGreaterThan(0);
        });

        it('excludes factions without data from sectorials', () => {
            const grouped = registry.getGroupedFactions();
            const yuJing = grouped.find(g => g.name === 'Yu Jing');
            // Imperial Service has no data, so shouldn't appear in sectorials
            expect(yuJing?.sectorials.some(s => s.name === 'Imperial Service')).toBe(false);
        });
    });

    describe('getValidFactionIds', () => {
        it('returns only faction IDs that have data', () => {
            const ids = registry.getValidFactionIds();
            // Only panoceania, military-orders, neoterra, yu-jing have data
            expect(ids).toContain(1);
            expect(ids).toContain(101);
            expect(ids).toContain(102);
            expect(ids).toContain(2);
            expect(ids).not.toContain(201); // Imperial Service has no data
        });
    });

    describe('getSuperFactionIds', () => {
        it('returns all faction IDs under a super-faction', () => {
            const ids = registry.getSuperFactionIds(1); // PanOceania
            expect(ids).toContain(1); // Vanilla
            expect(ids).toContain(101); // Military Orders
            expect(ids).toContain(102); // Neoterra
        });

        it('returns empty array for invalid super-faction', () => {
            const ids = registry.getSuperFactionIds(9999);
            expect(ids).toEqual([]);
        });
    });
});
