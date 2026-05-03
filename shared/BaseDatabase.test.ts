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

    it('stores faction-specific raw data in rawByFaction', async () => {
        // Simulate a unit that has different AVA in two factions (same ISC, different ids/data).
        // PanO has the unit with AVA=2; Yu Jing has the same ISC with AVA=4.
        function makeUnitWithAva(id: number, isc: string, factionIds: number[], ava: number): ProcessedUnit {
            const base = makeMockUnit(id, isc, factionIds);
            const unit = { ...base };
            unit.profileGroups = [{
                ...base.profileGroups[0],
                profiles: [{ ...base.profileGroups[0].profiles[0], ava }],
            }];
            return unit as unknown as ProcessedUnit;
        }

        const panoFile: ProcessedFactionFile = {
            faction: PANO_FACTION_FILE.faction,
            units: [makeUnitWithAva(10, 'Sierra Dronbot', [101], 1)],
        } as unknown as ProcessedFactionFile;

        const yjFile: ProcessedFactionFile = {
            faction: YU_JING_FACTION_FILE.faction,
            units: [makeUnitWithAva(20, 'Sierra Dronbot', [201], 2)],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([
            ['panoceania', panoFile],
            ['yu-jing', yjFile],
        ]));
        await db.init();

        const unit = db.units.find(u => u.isc === 'Sierra Dronbot');
        expect(unit).toBeDefined();
        // rawByFaction should map each faction to its specific ProcessedUnit
        expect(unit!.rawByFaction.get(101)!.profileGroups[0].profiles[0].ava).toBe(1);
        expect(unit!.rawByFaction.get(201)!.profileGroups[0].profiles[0].ava).toBe(2);
        // raw (faction-agnostic fallback) is whichever was ingested first
        expect(unit!.raw.profileGroups[0].profiles[0].ava).toBe(1);
    });

    it('handles units with empty factionIds using currentFactionId fallback', async () => {
        // Simulate the Yuan Yuan pattern: one entry has factionIds=[] in a faction file.
        function makeUnitEmptyFactions(id: number, isc: string, ava: number): ProcessedUnit {
            const base = makeMockUnit(id, isc, []);
            const unit = { ...base };
            unit.profileGroups = [{
                ...base.profileGroups[0],
                profiles: [{ ...base.profileGroups[0].profiles[0], ava }],
            }];
            return unit as unknown as ProcessedUnit;
        }

        const panoFile: ProcessedFactionFile = {
            faction: PANO_FACTION_FILE.faction,
            units: [
                makeMockUnit(10, 'Yuan Yuan', [101]),           // AVA=4 from makeMockUnit default
                makeUnitEmptyFactions(11, 'Yuan Yuan', 2),      // AVA=2, factionIds=[]
            ],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([['panoceania', panoFile]]));
        await db.init();

        const unit = db.units.find(u => u.isc === 'Yuan Yuan');
        expect(unit).toBeDefined();
        // The empty-factionIds entry should be attributed to the file's faction (101)
        // and override the rawByFaction entry for faction 101 with AVA=2.
        expect(unit!.rawByFaction.get(101)!.profileGroups[0].profiles[0].ava).toBe(2);
    });

    it('merges weapon/skill IDs from all faction entries into the cross-faction search index', async () => {
        // PanO entry: has weapon 1 (Combi Rifle) only
        // Yu Jing entry: same ISC, has weapon 2 (Heavy Machine Gun) only
        function makeUnitWithWeapon(id: number, isc: string, factionIds: number[], weaponId: number, weaponName: string): ProcessedUnit {
            const base = makeMockUnit(id, isc, factionIds);
            return {
                ...base,
                profileGroups: [{
                    ...base.profileGroups[0],
                    options: [{
                        ...base.profileGroups[0].options[0],
                        weapons: [{ id: weaponId, name: weaponName, modifiers: [], displayName: weaponName }],
                    }],
                }],
                allWeaponIds: [weaponId],
            } as unknown as ProcessedUnit;
        }

        const panoFile: ProcessedFactionFile = {
            faction: PANO_FACTION_FILE.faction,
            units: [makeUnitWithWeapon(10, 'Dronbot', [101], 1, 'Combi Rifle')],
        } as unknown as ProcessedFactionFile;

        const yjFile: ProcessedFactionFile = {
            faction: YU_JING_FACTION_FILE.faction,
            units: [makeUnitWithWeapon(20, 'Dronbot', [201], 2, 'Heavy Machine Gun')],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([
            ['panoceania', panoFile],
            ['yu-jing', yjFile],
        ]));
        await db.init();

        const unit = db.units.find(u => u.isc === 'Dronbot');
        expect(unit).toBeDefined();
        // Should contain weapons from both faction entries
        expect(unit!.allWeaponIds.has(1)).toBe(true);
        expect(unit!.allWeaponIds.has(2)).toBe(true);
        // allItemsWithMods should include both weapons
        const weaponNames = unit!.allItemsWithMods.filter(i => i.type === 'weapon').map(i => i.name);
        expect(weaponNames).toContain('Combi Rifle');
        expect(weaponNames).toContain('Heavy Machine Gun');
    });

    it('deduplicates allItemsWithMods when the same item appears in multiple faction entries', async () => {
        // Both factions have the same weapon — should not appear twice in allItemsWithMods
        const panoFile: ProcessedFactionFile = {
            faction: PANO_FACTION_FILE.faction,
            units: [makeMockUnit(10, 'Shared', [101])],
        } as unknown as ProcessedFactionFile;

        const yjFile: ProcessedFactionFile = {
            faction: YU_JING_FACTION_FILE.faction,
            units: [makeMockUnit(20, 'Shared', [201])],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([
            ['panoceania', panoFile],
            ['yu-jing', yjFile],
        ]));
        await db.init();

        const unit = db.units.find(u => u.isc === 'Shared');
        expect(unit).toBeDefined();
        // Combi Rifle (id=1) should appear exactly once in allItemsWithMods
        const combiEntries = unit!.allItemsWithMods.filter(i => i.type === 'weapon' && i.id === 1);
        expect(combiEntries).toHaveLength(1);
    });

    it('extends pointsRange to cover all faction entries', async () => {
        function makeUnitWithPoints(id: number, isc: string, factionIds: number[], points: number): ProcessedUnit {
            const base = makeMockUnit(id, isc, factionIds);
            return {
                ...base,
                profileGroups: [{
                    ...base.profileGroups[0],
                    options: [{
                        ...base.profileGroups[0].options[0],
                        points,
                    }],
                }],
                pointsRange: [points, points],
            } as unknown as ProcessedUnit;
        }

        // PanO: unit costs 20pts; Yu Jing: same ISC costs 35pts
        const panoFile: ProcessedFactionFile = {
            faction: PANO_FACTION_FILE.faction,
            units: [makeUnitWithPoints(10, 'Mercenary', [101], 20)],
        } as unknown as ProcessedFactionFile;

        const yjFile: ProcessedFactionFile = {
            faction: YU_JING_FACTION_FILE.faction,
            units: [makeUnitWithPoints(20, 'Mercenary', [201], 35)],
        } as unknown as ProcessedFactionFile;

        const db = new TestDatabase(new Map([
            ['panoceania', panoFile],
            ['yu-jing', yjFile],
        ]));
        await db.init();

        const unit = db.units.find(u => u.isc === 'Mercenary');
        expect(unit).toBeDefined();
        expect(unit!.pointsRange[0]).toBe(20); // min across factions
        expect(unit!.pointsRange[1]).toBe(35); // max across factions
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
