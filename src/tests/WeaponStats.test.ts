import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDatabase } from '../../shared/BaseDatabase';
import type { ProcessedFactionFile, ProcessedMetadataFile, ProcessedFactionsFile } from '../../shared/game-model';

// Mock Database Implementation for testing
class TestDatabase extends BaseDatabase {
    protected loadMetadataFiles(): Promise<{ meta: ProcessedMetadataFile; factions: ProcessedFactionsFile }> {
        return Promise.resolve({
            meta: {
                version: '2.0',
                weapons: [
                    {
                        id: 101,
                        name: 'Combi Rifle',
                        weaponType: 'WEAPON',
                        burst: '3',
                        damage: '13',
                        saving: 'ARM',
                        savingNum: '1',
                        ammunition: 1, // AP
                        properties: ['Combi'],
                        distance: {
                            short: { max: 40, mod: '+3' }, // 40cm * 0.4 = 16"
                            medium: { max: 80, mod: '-3' },
                            long: { max: 120, mod: '-6' },
                            max: { max: 120, mod: '-6' },
                        }
                    },
                    {
                        id: 102,
                        name: 'Chain Rifle',
                        weaponType: 'WEAPON',
                        burst: '1',
                        damage: '13',
                        saving: 'ARM',
                        savingNum: '1',
                        ammunition: 0,
                        properties: ['Direct Template', 'Large Teardrop'],
                        distance: undefined
                    }
                ],
                skills: [],
                equipment: [],
                ammunitions: [
                    { id: 1, name: 'AP' },
                    { id: 2, name: 'DA' }
                ]
            },
            factions: {
                version: '2.0',
                factions: []
            }
        });
    }

    protected loadFactionData(_slug: string): Promise<ProcessedFactionFile | null> {
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
