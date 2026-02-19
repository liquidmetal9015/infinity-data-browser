import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDatabase, type FactionDataFile } from '../../shared/BaseDatabase';
import { parseWeapon } from '../../shared/weapon-utils';
import type { DatabaseMetadata, UnitRaw, ParsedWeapon } from '../../shared/types';

// Mock Database Implementation for testing
class TestDatabase extends BaseDatabase {
    protected loadMetadata(): Promise<DatabaseMetadata> {
        return Promise.resolve({
            factions: [],
            ammunitions: [{ id: 1, name: 'AP' }, { id: 2, name: 'DA' }],
            weapons: [
                {
                    id: 101,
                    name: "Combi Rifle",
                    burst: "3",
                    damage: "13",
                    ammunition: 1, // AP
                    properties: ["Combi"],
                    distance: {
                        short: { max: 40, mod: "+3" }, // cm, roughly 16"
                        med: { max: 80, mod: "-3" }, // cm, roughly 32"
                        long: { max: 120, mod: "-6" },
                        max: { max: 120, mod: "-6" }
                    }
                },
                {
                    id: 102,
                    name: "Chain Rifle",
                    burst: "1",
                    damage: "13",
                    ammunition: 0,
                    properties: ["Direct Template", "Large Teardrop"],
                    distance: null // Template weapon often has null distance
                }
            ],
            skills: [],
            equips: []
        });
    }

    protected loadFactionData(slug: string): Promise<FactionDataFile | null> {
        return Promise.resolve(null);
    }
}

describe('Weapon Parsing and Database Integration', () => {
    let db: TestDatabase;

    beforeEach(async () => {
        db = new TestDatabase();
        await db.init();
    });

    it('should parse weapon stats correctly during initialization', () => {
        const weapon = db.getWeaponDetails(101); // Combi Rifle

        expect(weapon).toBeDefined();
        if (!weapon) return;

        expect(weapon.name).toBe('Combi Rifle');
        expect(weapon.burst).toBe('3');
        expect(weapon.damage).toBe('13');
        expect(weapon.ammunition).toBe('AP');

        // detailed band check
        // 40cm * 0.4 = 16 inches
        expect(weapon.bands.length).toBeGreaterThan(0);
        expect(weapon.bands[0].end).toBe(16);
        expect(weapon.bands[0].mod).toBe(3);
    });

    it('should handle template weapons correctly', () => {
        const weapon = db.getWeaponDetails(102); // Chain Rifle

        expect(weapon).toBeDefined();
        if (!weapon) return;

        expect(weapon.templateType).toBe('large');
        expect(weapon.bands).toEqual([]);
    });

    it('should result in getWeaponDetails returning undefined for unknown IDs', () => {
        const weapon = db.getWeaponDetails(999);
        expect(weapon).toBeUndefined();
    });
});
