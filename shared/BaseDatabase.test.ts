import { describe, it, expect } from 'vitest';
import { BaseDatabase } from './BaseDatabase';
import type { ProcessedMetadataFile, ProcessedFactionsFile, ProcessedFactionFile, ProcessedUnit } from './game-model';

// ============================================================================
// Minimal test fixtures
// ============================================================================

const MOCK_METADATA: ProcessedMetadataFile = {
    version: '2.0',
    weapons: [
        { id: 1, name: 'Combi Rifle', wikiUrl: 'https://wiki/combi', weaponType: 'BS', burst: '3', damage: '13', saving: 'ARM', savingNum: '', ammunition: 1, properties: [], distance: undefined },
        { id: 2, name: 'Heavy Machine Gun', wikiUrl: '', weaponType: 'BS', burst: '4', damage: '15', saving: 'ARM', savingNum: '', ammunition: 1, properties: [], distance: undefined },
    ],
    skills: [
        { id: 10, name: 'Camouflage', wikiUrl: 'https://wiki/camo' },
        { id: 11, name: 'Doctor', wikiUrl: '' },
    ],
    equipment: [
        { id: 20, name: 'Multispectral Visor', wikiUrl: '' },
    ],
    ammunitions: [
        { id: 1, name: 'Normal', wikiUrl: '' },
    ],
};

const MOCK_FACTIONS: ProcessedFactionsFile = {
    version: '2.0',
    factions: [
        { id: 101, parentId: 101, name: 'PanOceania', slug: 'panoceania', discontinued: false, logo: '', fireteams: null, isVanilla: true },
        { id: 201, parentId: 201, name: 'Yu Jing', slug: 'yu-jing', discontinued: false, logo: '', fireteams: null, isVanilla: true },
    ],
};

function makeMockUnit(id: number, isc: string, factionIds: number[]): ProcessedUnit {
    return {
        id,
        isc,
        name: isc,
        slug: isc.toLowerCase().replace(/\s+/g, '-'),
        factionIds,
        profileGroups: [{
            id: 1,
            isc,
            isAutoAttached: false,
            isPeripheral: false,
            profiles: [{
                id: 1,
                name: 'Default',
                mov: '4-4',
                cc: 13,
                bs: 12,
                ph: 10,
                wip: 13,
                arm: 1,
                bts: 0,
                w: 1,
                s: 2,
                ava: 4,
                unitType: 1,
                skills: [{ id: 10, name: 'Camouflage', modifiers: [] }],
                weapons: [{ id: 1, name: 'Combi Rifle', modifiers: [] }],
                equipment: [],
            }],
            options: [{
                id: 1,
                name: 'Combi Rifle',
                points: 25,
                swc: 0,
                disabled: false,
                skills: [],
                weapons: [{ id: 1, name: 'Combi Rifle', modifiers: [] }],
                equipment: [],
                peripheral: [],
                includes: [],
            }],
        }],
        allWeaponIds: [1],
        allSkillIds: [10],
        allEquipmentIds: [],
        pointsRange: [25, 25],
        hasPeripherals: false,
    } as unknown as ProcessedUnit;
}

const PANO_FACTION_FILE: ProcessedFactionFile = {
    faction: { id: 101, parentId: 101, name: 'PanOceania', slug: 'panoceania', discontinued: false, logo: '', fireteams: null, isVanilla: true },
    units: [
        makeMockUnit(1, 'Fusiliers', [101]),
        makeMockUnit(2, 'Orc Troops', [101]),
    ],
} as unknown as ProcessedFactionFile;

const YU_JING_FACTION_FILE: ProcessedFactionFile = {
    faction: { id: 201, parentId: 201, name: 'Yu Jing', slug: 'yu-jing', discontinued: false, logo: '', fireteams: null, isVanilla: true },
    units: [
        makeMockUnit(3, 'Zhanshi', [201]),
        makeMockUnit(4, 'Hsien', [201]),
    ],
} as unknown as ProcessedFactionFile;

// ============================================================================
// Concrete Test Subclass
// ============================================================================

class TestDatabase extends BaseDatabase {
    private factionFiles: Map<string, ProcessedFactionFile>;
    loadMetadataCallCount = 0;
    loadFactionCallCount = 0;

    constructor(factionFiles: Map<string, ProcessedFactionFile> = new Map()) {
        super();
        this.factionFiles = factionFiles;
    }

    protected async loadMetadataFiles() {
        this.loadMetadataCallCount++;
        return { meta: MOCK_METADATA, factions: MOCK_FACTIONS };
    }

    protected async loadFactionData(slug: string) {
        this.loadFactionCallCount++;
        return this.factionFiles.get(slug) ?? null;
    }
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseDatabase - init', () => {
    it('initializes and loads units from all factions', async () => {
        const db = new TestDatabase(new Map([
            ['panoceania', PANO_FACTION_FILE],
            ['yu-jing', YU_JING_FACTION_FILE],
        ]));

        await db.init();

        expect(db.units.length).toBe(4);
        expect(db.metadata).not.toBeNull();
        expect(db.metadata!.factions).toHaveLength(2);
    });

    it('populates weapon/skill/equipment maps from metadata', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        expect(db.weaponMap.get(1)).toBe('Combi Rifle');
        expect(db.weaponMap.get(2)).toBe('Heavy Machine Gun');
        expect(db.skillMap.get(10)).toBe('Camouflage');
        expect(db.equipmentMap.get(20)).toBe('Multispectral Visor');
    });

    it('populates wiki link maps', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        expect(db.weaponWikiMap.get(1)).toBe('https://wiki/combi');
        expect(db.skillWikiMap.get(10)).toBe('https://wiki/camo');
        // Empty wiki strings should not be stored
        expect(db.weaponWikiMap.has(2)).toBe(false);
    });

    it('deduplicates units by ISC', async () => {
        // Both factions have a unit that shares the same ISC
        const sharedUnit = makeMockUnit(5, 'Fusiliers', [201]);
        const yjFile: ProcessedFactionFile = {
            ...YU_JING_FACTION_FILE,
            units: [sharedUnit, ...YU_JING_FACTION_FILE.units],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([
            ['panoceania', PANO_FACTION_FILE],
            ['yu-jing', yjFile],
        ]));
        await db.init();

        // "Fusiliers" appears in both factions but should be deduplicated
        const fusiliers = db.units.filter(u => u.isc === 'Fusiliers');
        expect(fusiliers).toHaveLength(1);
        // Should have both faction IDs merged
        expect(fusiliers[0].factions).toContain(101);
        expect(fusiliers[0].factions).toContain(201);
    });

    it('only initializes once (idempotent)', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));

        await db.init();
        await db.init();
        await db.init();

        expect(db.loadMetadataCallCount).toBe(1);
    });

    it('handles partial faction load failure gracefully', async () => {
        const db = new TestDatabase(new Map([
            ['panoceania', PANO_FACTION_FILE],
            // yu-jing is missing from the map → loadFactionData returns null
        ]));

        await db.init();

        // Should still have PanO units
        expect(db.units.length).toBe(2);
    });
});

describe('BaseDatabase - getUnitById', () => {
    it('resolves units by numeric ID', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        const unit = db.getUnitById(1);
        expect(unit).toBeDefined();
        expect(unit!.isc).toBe('Fusiliers');
    });

    it('returns undefined for unknown IDs', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        expect(db.getUnitById(999)).toBeUndefined();
    });
});

describe('BaseDatabase - getUnitBySlug', () => {
    it('resolves units by slug', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        const unit = db.getUnitBySlug('fusiliers');
        expect(unit).toBeDefined();
        expect(unit!.isc).toBe('Fusiliers');
    });

    it('resolves units by ISC directly', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));
        await db.init();

        const unit = db.getUnitBySlug('Orc Troops');
        expect(unit).toBeDefined();
        expect(unit!.id).toBe(2);
    });
});

describe('BaseDatabase - concurrent init', () => {
    it('concurrent init calls all complete without errors', async () => {
        const db = new TestDatabase(new Map([['panoceania', PANO_FACTION_FILE]]));

        // Fire multiple inits concurrently — all should resolve
        await Promise.all([db.init(), db.init(), db.init()]);

        // Database ends up in a valid state
        expect(db.units.length).toBe(2);
        expect(db.metadata).not.toBeNull();
    });
});
