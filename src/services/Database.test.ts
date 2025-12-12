import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseImplementation } from './Database';
import type { UnitRaw, DatabaseMetadata } from '../types';

// Mock data
const mockMetadata: DatabaseMetadata = {
    factions: [
        { id: 1, parent: 1, name: "PanOceania", slug: "panoceania", discontinued: false, logo: "" },
        { id: 2, parent: 1, name: "Varuna", slug: "varuna", discontinued: false, logo: "" }
    ],
    weapons: [{ id: 101, name: "Combi Rifle" }],
    skills: [{ id: 201, name: "Mimetism" }],
    equips: [{ id: 301, name: "Multispectral Visor" }],
    ammunitions: [{ id: 1, name: "AP" }]
};

const mockUnitRaw: UnitRaw = {
    id: 1,
    isc: "FUSILIER",
    name: "Fusilier",
    factions: [1, 2],
    profileGroups: [{
        id: 1,
        profiles: [{
            id: 1,
            name: "Fusilier",
            skills: [{ id: 201, extra: [6] }], // Mimetism(-6) essentially
            equip: [],
            weapons: [{ id: 101 }],
            move: [4, 4],
            cc: 13,
            bs: 11,
            ph: 10,
            wip: 13,
            arm: 1,
            bts: 0,
            w: 1,
            s: 2
        }],
        options: [{
            id: 1,
            name: "",
            points: 10,
            swc: 0,
            skills: [],
            equip: [],
            weapons: []
        }]
    }]
};

const mockFactionData = {
    units: [mockUnitRaw],
    filters: {
        extras: [{ id: 6, name: "-3" }] // Intentionally mapping ID 6 -> "-3" for test check
    }
};

describe('DatabaseImplementation', () => {
    let db: DatabaseImplementation;

    beforeEach(() => {
        // Reset singleton (if accessing logic that uses it, though we use instance here)
        // Since we are unit testing the class, we can instantiate it directly.
        // However, the class uses a private constructor? No, I allowed public constructor in refactor.
        // Wait, I kept `private constructor() {}` in existing code?
        // Let's check. Step 74: `constructor() { }` (public). Good.
        db = new DatabaseImplementation();

        // Mock fetch
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('metadata.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockMetadata)
                });
            }
            if (url.includes('panoceania.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockFactionData)
                });
            }
            return Promise.resolve({ ok: false });
        });

        vi.stubGlobal('fetch', mockFetch);
    });

    it('initializes correctly', async () => {
        await db.init();
        expect(db.units.length).toBe(1);
        expect(db.getFactionName(1)).toBe("PanOceania");
    });

    it('searches with modifiers correctly', async () => {
        await db.init();

        // Search for Mimetism (baseId 201) with modifier 6 (which maps to "-3")
        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: [6],
            matchAnyModifier: false
        }], 'or');

        expect(results.length).toBe(1);
        expect(results[0].name).toBe("Fusilier");
    });

    it('searches with matchAnyModifier correctly', async () => {
        await db.init();

        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: [999], // Wrong modifier
            matchAnyModifier: true // But matching any
        }], 'or');

        expect(results.length).toBe(1);
    });

    it('filters out non-matching modifiers', async () => {
        await db.init();

        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: [999], // Wrong modifier
            matchAnyModifier: false
        }], 'or');

        expect(results.length).toBe(0);
    });

    it('generates suggestions correctly', async () => {
        await db.init();

        db.getSuggestions("Fusilier"); // Matches unit name? 
        // Logic checks item variants, not unit names. 
        // Suggestion logic builds from items. "Mimetism".

        const res = db.getSuggestions("Mime");
        expect(res.length).toBeGreaterThan(0);
        expect(res[0].name).toBe("Mimetism");
        // The first result is the "(any)" variant which matches all modifiers
        expect(res[0].displayName).toBe("Mimetism (any)");
        expect(res[0].isAnyVariant).toBe(true);
    });
});
