import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProcessedMetadataFile, ProcessedFactionsFile, ProcessedFactionFile } from '../../shared/game-model';

import { DatabaseImplementation } from './Database';

const mockMetaFile: ProcessedMetadataFile = {
    version: '2.0',
    weapons: [{ id: 101, name: 'Combi Rifle', wikiUrl: '', weaponType: 'WEAPON', burst: '3', damage: '13', saving: 'ARM', savingNum: '0', properties: [] }],
    skills: [{ id: 201, name: 'Mimetism', wikiUrl: '' }],
    equipment: [{ id: 301, name: 'Multispectral Visor', wikiUrl: '' }],
    ammunitions: [{ id: 1, name: 'AP', wikiUrl: '' }],
};

const mockFactionsFile: ProcessedFactionsFile = {
    version: '2.0',
    factions: [
        { id: 1, parentId: 1, name: 'PanOceania', slug: 'panoceania', isVanilla: true, discontinued: false, logo: '', fireteams: null },
        { id: 2, parentId: 1, name: 'Varuna', slug: 'varuna', isVanilla: false, discontinued: false, logo: '', fireteams: null },
    ],
};

const mockFactionFile: ProcessedFactionFile = {
    version: '2.0',
    faction: {
        id: 1,
        name: 'PanOceania',
        slug: 'panoceania',
        parentId: 1,
        isVanilla: true,
        discontinued: false,
        logo: '',
        fireteams: { spec: { CORE: 0, HARIS: 0, DUO: 0 }, compositions: [] },
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
            category: 1,
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
                ava: 255,
                characteristics: [],
                skills: [{ id: 201, name: 'Mimetism', modifiers: ['-6'], displayName: 'Mimetism(-6)' }],
                equipment: [],
                weapons: [],
            }],
            options: [{
                id: 1,
                name: 'Combi Rifle',
                points: 10,
                swc: 0,
                minis: 1,
                skills: [],
                equipment: [],
                weapons: [{ id: 101, name: 'Combi Rifle', modifiers: [], displayName: 'Combi Rifle' }],
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
