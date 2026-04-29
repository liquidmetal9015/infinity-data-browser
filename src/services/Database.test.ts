import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UnitRaw, DatabaseMetadata } from '@shared/types';

// Mock the api module before importing DatabaseImplementation so openapi-fetch
// never attempts URL construction in the jsdom environment.
vi.mock('./api', () => ({
    default: {
        GET: vi.fn(),
    },
}));

import { DatabaseImplementation } from './Database';
import api from './api';

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
        db = new DatabaseImplementation();

        // Wire up the mocked api.GET to return the appropriate fixture data per path.
        vi.mocked(api.GET).mockImplementation((async (path: string) => {
            if (path === '/api/metadata') {
                return {
                    data: {
                        weapons: mockMetadata.weapons,
                        skills: mockMetadata.skills,
                        equipment: mockMetadata.equips,
                        ammunitions: mockMetadata.ammunitions,
                    },
                    error: undefined,
                    response: new Response(),
                };
            }
            if (path === '/api/factions') {
                // Return SuperFactionResponse[] — grouped by super-faction
                return {
                    data: [{
                        id: 1,
                        name: 'PanOceania',
                        vanilla: { id: 1, name: 'PanOceania', slug: 'panoceania', parent_id: null, is_vanilla: true, discontinued: false, logo: '' },
                        sectorials: [{ id: 2, name: 'Varuna', slug: 'varuna', parent_id: 1, is_vanilla: false, discontinued: false, logo: '' }],
                    }],
                    error: undefined,
                    response: new Response(),
                };
            }
            if (path === '/api/factions/{slug}/legacy') {
                return { data: mockFactionData, error: undefined, response: new Response() };
            }
            return { data: undefined, error: 'Not found', response: new Response(null, { status: 404 }) };
        }) as unknown as typeof api.GET);

        // classifieds.json is loaded via plain fetch — stub it to return empty
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
        ));
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
