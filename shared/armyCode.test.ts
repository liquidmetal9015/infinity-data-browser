import { describe, it, expect } from 'vitest';
import {
    encodeArmyList,
    decodeArmyCode,
    isValidArmyCode,
    type EncodableArmyList,
    type DecodedArmyList,
} from './armyCode';
import type { Unit } from './types';

// Minimal mock unit factory
function mockUnit(id: number): Unit {
    return {
        id,
        isc: `Unit_${id}`,
        name: `Unit ${id}`,
        factions: [1],
        allWeaponIds: new Set(),
        allSkillIds: new Set(),
        allEquipmentIds: new Set(),
        allItemsWithMods: [],
        pointsRange: [20, 40],
        raw: {} as any,
    };
}

// Helper: encode then decode and verify round-trip
function roundTrip(list: EncodableArmyList, factionSlug: string): DecodedArmyList {
    const code = encodeArmyList(list, factionSlug, (u) => u.id);
    return decodeArmyCode(code);
}

describe('armyCode - VLI encoding round-trip', () => {
    it('encodes and decodes single-unit list', () => {
        const list: EncodableArmyList = {
            factionId: 5,
            name: 'Test List',
            pointsLimit: 300,
            groups: [{
                units: [{ unit: mockUnit(42), profileGroupId: 1, optionId: 3 }],
            }],
        };

        const decoded = roundTrip(list, 'panoceania');

        expect(decoded.factionId).toBe(5);
        expect(decoded.factionSlug).toBe('panoceania');
        expect(decoded.armyName).toBe('Test List');
        expect(decoded.maxPoints).toBe(300);
        expect(decoded.combatGroups).toHaveLength(1);
        expect(decoded.combatGroups[0].members).toHaveLength(1);
        expect(decoded.combatGroups[0].members[0]).toEqual({
            unitId: 42,
            groupChoice: 1,
            optionChoice: 3,
        });
    });

    it('encodes and decodes empty list (no units)', () => {
        const list: EncodableArmyList = {
            factionId: 1,
            name: 'Empty',
            pointsLimit: 150,
            groups: [{ units: [] }],
        };

        const decoded = roundTrip(list, 'yu-jing');

        expect(decoded.factionId).toBe(1);
        expect(decoded.maxPoints).toBe(150);
        expect(decoded.combatGroups).toHaveLength(1);
        expect(decoded.combatGroups[0].members).toHaveLength(0);
    });

    it('encodes and decodes multiple combat groups', () => {
        const list: EncodableArmyList = {
            factionId: 10,
            name: 'Multi Group',
            pointsLimit: 400,
            groups: [
                { units: [{ unit: mockUnit(1), profileGroupId: 0, optionId: 0 }] },
                { units: [{ unit: mockUnit(2), profileGroupId: 1, optionId: 2 }] },
                { units: [{ unit: mockUnit(3), profileGroupId: 0, optionId: 5 }] },
            ],
        };

        const decoded = roundTrip(list, 'haqqislam');

        expect(decoded.combatGroups).toHaveLength(3);
        expect(decoded.combatGroups[0].members[0].unitId).toBe(1);
        expect(decoded.combatGroups[1].members[0].unitId).toBe(2);
        expect(decoded.combatGroups[2].members[0].unitId).toBe(3);
    });

    it('encodes and decodes many units in one group', () => {
        const units = Array.from({ length: 10 }, (_, i) => ({
            unit: mockUnit(100 + i),
            profileGroupId: i % 3,
            optionId: i * 2,
        }));

        const list: EncodableArmyList = {
            factionId: 3,
            name: 'Full Group',
            pointsLimit: 300,
            groups: [{ units }],
        };

        const decoded = roundTrip(list, 'ariadna');

        expect(decoded.combatGroups[0].members).toHaveLength(10);
        decoded.combatGroups[0].members.forEach((m, i) => {
            expect(m.unitId).toBe(100 + i);
            expect(m.groupChoice).toBe(i % 3);
            expect(m.optionChoice).toBe(i * 2);
        });
    });

    it('handles large VLI values (unitId > 127)', () => {
        const list: EncodableArmyList = {
            factionId: 200,
            name: 'Big IDs',
            pointsLimit: 500,
            groups: [{
                units: [
                    { unit: mockUnit(200), profileGroupId: 150, optionId: 300 },
                    { unit: mockUnit(1000), profileGroupId: 0, optionId: 500 },
                ],
            }],
        };

        const decoded = roundTrip(list, 'combined-army');

        expect(decoded.factionId).toBe(200);
        expect(decoded.maxPoints).toBe(500);
        expect(decoded.combatGroups[0].members[0].unitId).toBe(200);
        expect(decoded.combatGroups[0].members[0].groupChoice).toBe(150);
        expect(decoded.combatGroups[0].members[0].optionChoice).toBe(300);
        expect(decoded.combatGroups[0].members[1].unitId).toBe(1000);
        expect(decoded.combatGroups[0].members[1].optionChoice).toBe(500);
    });

    it('handles unicode army name', () => {
        const list: EncodableArmyList = {
            factionId: 7,
            name: 'Señor Massacre™ 日本語',
            pointsLimit: 300,
            groups: [{ units: [{ unit: mockUnit(1), profileGroupId: 0, optionId: 0 }] }],
        };

        const decoded = roundTrip(list, 'nomads');

        expect(decoded.armyName).toBe('Señor Massacre™ 日本語');
    });

    it('handles missing name (uses space fallback)', () => {
        const list: EncodableArmyList = {
            factionId: 2,
            pointsLimit: 200,
            groups: [{ units: [{ unit: mockUnit(5), profileGroupId: 0, optionId: 1 }] }],
        };

        const decoded = roundTrip(list, 'aleph');

        // encodeArmyList uses ' ' (space) when name is undefined
        expect(decoded.armyName).toBe(' ');
    });

    it('preserves groupNumber sequencing', () => {
        const list: EncodableArmyList = {
            factionId: 4,
            name: 'Sequence',
            pointsLimit: 300,
            groups: [
                { units: [{ unit: mockUnit(1), profileGroupId: 0, optionId: 0 }] },
                { units: [{ unit: mockUnit(2), profileGroupId: 0, optionId: 0 }] },
            ],
        };

        const decoded = roundTrip(list, 'tohaa');

        expect(decoded.combatGroups[0].groupNumber).toBe(1);
        expect(decoded.combatGroups[1].groupNumber).toBe(2);
    });
});

describe('armyCode - isValidArmyCode', () => {
    it('returns true for a valid encoded list', () => {
        const list: EncodableArmyList = {
            factionId: 1,
            name: 'Valid',
            pointsLimit: 300,
            groups: [{ units: [{ unit: mockUnit(10), profileGroupId: 0, optionId: 0 }] }],
        };
        const code = encodeArmyList(list, 'test', (u) => u.id);
        expect(isValidArmyCode(code)).toBe(true);
    });

    it('returns false for garbage input', () => {
        expect(isValidArmyCode('not-a-valid-code!!!')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isValidArmyCode('')).toBe(false);
    });

    it('returns false for truncated code', () => {
        const list: EncodableArmyList = {
            factionId: 1,
            name: 'Truncated',
            pointsLimit: 300,
            groups: [{ units: [{ unit: mockUnit(10), profileGroupId: 0, optionId: 0 }] }],
        };
        const code = encodeArmyList(list, 'test', (u) => u.id);
        // Chop code in half
        const truncated = code.substring(0, Math.floor(code.length / 2));
        expect(isValidArmyCode(truncated)).toBe(false);
    });
});

describe('armyCode - edge cases', () => {
    it('getUnitId callback is used (not unit.id directly)', () => {
        const unit = mockUnit(99);
        const list: EncodableArmyList = {
            factionId: 1,
            name: 'Custom ID',
            pointsLimit: 300,
            groups: [{ units: [{ unit, profileGroupId: 0, optionId: 0 }] }],
        };

        // getUnitId returns a different ID than unit.id
        const code = encodeArmyList(list, 'test', () => 777);
        const decoded = decodeArmyCode(code);

        expect(decoded.combatGroups[0].members[0].unitId).toBe(777);
    });

    it('URL-encoded army code is handled', () => {
        const list: EncodableArmyList = {
            factionId: 1,
            name: 'URL Test',
            pointsLimit: 300,
            groups: [{ units: [{ unit: mockUnit(1), profileGroupId: 0, optionId: 0 }] }],
        };
        const code = encodeArmyList(list, 'test', (u) => u.id);
        // URL-encode the code
        const urlEncoded = encodeURIComponent(code);
        const decoded = decodeArmyCode(urlEncoded);

        expect(decoded.factionId).toBe(1);
        expect(decoded.armyName).toBe('URL Test');
    });
});
