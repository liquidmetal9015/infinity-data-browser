import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProcessedMetadataFile, ProcessedFactionsFile, ProcessedFactionFile } from '../../shared/game-model';

import { DatabaseImplementation } from './Database';

const mockMetaFile: ProcessedMetadataFile = {
    weapons: [{ id: 101, name: 'Combi Rifle', wikiUrl: '', weaponType: '', burst: '3', damage: '13', saving: 'ARM', savingNum: '0', properties: [], distance: null }],
    skills: [{ id: 201, name: 'Mimetism', wikiUrl: '' }],
    equipment: [{ id: 301, name: 'Multispectral Visor', wikiUrl: '' }],
    ammunitions: [{ id: 1, name: 'AP', wikiUrl: '' }],
};

const mockFactionsFile: ProcessedFactionsFile = {
    factions: [
        { id: 1, parentId: 1, name: 'PanOceania', slug: 'panoceania', discontinued: false, logo: '' },
        { id: 2, parentId: 1, name: 'Varuna', slug: 'varuna', discontinued: false, logo: '' },
    ],
};

const mockFactionFile: ProcessedFactionFile = {
    faction: {
        id: 1,
        slug: 'panoceania',
        fireteams: { spec: {}, compositions: [] },
    },
    units: [{
        id: 1,
        isc: 'FUSILIER',
        name: 'Fusilier',
        factionIds: [1, 2],
        slug: 'fusilier',
        allWeaponIds: [101],
        allSkillIds: [201],
        allEquipmentIds: [],
        pointsRange: [10, 10] as [number, number],
        hasPeripherals: false,
        profileGroups: [{
            id: 1,
            isc: 'Fusilier',
            isPeripheral: false,
            isFTO: false,
            profiles: [{
                id: 1,
                name: 'Fusilier',
                unitType: 1,
                move: [4, 4],
                cc: 13,
                bs: 11,
                ph: 10,
                wip: 13,
                arm: 1,
                bts: 0,
                w: 1,
                s: 2,
                isStructure: false,
                skills: [{ id: 201, name: 'Mimetism', modifiers: ['-6'], displayName: 'Mimetism(-6)' }],
                equipment: [],
                weapons: [],
            }],
            options: [{
                id: 1,
                name: 'Combi Rifle',
                points: 10,
                swc: 0,
                skills: [],
                equipment: [],
                weapons: [{ id: 101, name: 'Combi Rifle', modifiers: [], burst: '3', damage: '13', distance: null }],
                orders: [],
            }],
        }],
    }],
};

describe('DatabaseImplementation', () => {
    let db: DatabaseImplementation;

    beforeEach(() => {
        db = new DatabaseImplementation();

        vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('metadata.json')) {
                return new Response(JSON.stringify(mockMetaFile), { status: 200 });
            }
            if (url.includes('factions.json')) {
                return new Response(JSON.stringify(mockFactionsFile), { status: 200 });
            }
            if (url.includes('panoceania.json') || url.includes('varuna.json')) {
                return new Response(JSON.stringify(mockFactionFile), { status: 200 });
            }
            if (url.includes('classifieds.json')) {
                return new Response(JSON.stringify([]), { status: 200 });
            }
            return new Response(null, { status: 404 });
        }));
    });

    it('initializes correctly', async () => {
        await db.init();
        expect(db.units.length).toBeGreaterThan(0);
        expect(db.getFactionName(1)).toBe('PanOceania');
    });

    it('searches with modifiers correctly', async () => {
        await db.init();

        // Search for Mimetism (baseId 201) with modifier '-6'
        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: ['-6'],
            matchAnyModifier: false
        }], 'or');

        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Fusilier');
    });

    it('searches with matchAnyModifier correctly', async () => {
        await db.init();

        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: ['wrong-modifier'],
            matchAnyModifier: true
        }], 'or');

        expect(results.length).toBe(1);
    });

    it('filters out non-matching modifiers', async () => {
        await db.init();

        const results = db.searchWithModifiers([{
            type: 'skill',
            baseId: 201,
            modifiers: ['wrong-modifier'],
            matchAnyModifier: false
        }], 'or');

        expect(results.length).toBe(0);
    });

    it('generates suggestions correctly', async () => {
        await db.init();

        const res = db.getSuggestions('Mime');
        expect(res.length).toBeGreaterThan(0);
        expect(res[0].name).toBe('Mimetism');
        expect(res[0].displayName).toBe('Mimetism (any)');
        expect(res[0].isAnyVariant).toBe(true);
    });
});
