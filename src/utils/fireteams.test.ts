import { describe, it, expect } from 'vitest';
import { getUnitTags, calculateFireteamLevel, getFireteamBonuses } from './fireteams';
import type { Fireteam } from '../types';

describe('getUnitTags', () => {
    it('always includes the unit name in lowercase', () => {
        const tags = getUnitTags('Fusilier');
        expect(tags).toContain('fusilier');
    });

    it('extracts wildcard tag from comment', () => {
        const tags = getUnitTags('Some Unit', 'Wildcard');
        expect(tags).toContain('wildcard');
    });

    it('parses "counts as" comments', () => {
        const tags = getUnitTags('Karhu', '(Counts as WinterFor)');
        expect(tags).toContain('winterfor');
    });

    it('handles comma-separated values in comment', () => {
        const tags = getUnitTags('Unit', 'TAG1, TAG2, TAG3');
        expect(tags).toContain('tag1');
        expect(tags).toContain('tag2');
        expect(tags).toContain('tag3');
    });

    it('returns only name when no comment', () => {
        const tags = getUnitTags('SimpleUnit');
        expect(tags).toEqual(['simpleunit']);
    });
});

describe('calculateFireteamLevel', () => {
    it('returns 0 for empty team', () => {
        const level = calculateFireteamLevel('Fusilier Fireteam', []);
        expect(level).toBe(0);
    });

    it('counts matching members for team level', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Fusilier' },
            { name: 'Fusilier' },
        ];
        const level = calculateFireteamLevel('Fusilier Fireteam', members);
        expect(level).toBe(3);
    });

    it('counts wildcards as matching', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Some Wildcard', comment: 'Wildcard' },
        ];
        const level = calculateFireteamLevel('Fusilier Fireteam', members);
        expect(level).toBe(2);
    });

    it('does not count non-matching members', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Some Other Unit' },
        ];
        const level = calculateFireteamLevel('Fusilier Fireteam', members);
        expect(level).toBe(1);
    });
});

describe('getFireteamBonuses', () => {
    const mockDuoTeam: Fireteam = {
        name: 'Test Duo',
        type: ['DUO'],
        units: [
            { name: 'UnitA', slug: 'unit-a', min: 0, max: 2 },
            { name: 'UnitB', slug: 'unit-b', min: 0, max: 2 },
        ],
    };

    const mockCoreTeam: Fireteam = {
        name: 'Test Core Fireteam',
        type: ['CORE'],
        units: [
            { name: 'Test', slug: 'test', min: 0, max: 5 },
        ],
    };

    it('returns 5 bonus levels', () => {
        const bonuses = getFireteamBonuses(mockDuoTeam, []);
        expect(bonuses).toHaveLength(5);
    });

    it('level 1 is active for valid duo (2 members)', () => {
        const members = [
            { name: 'UnitA' },
            { name: 'UnitB' },
        ];
        const bonuses = getFireteamBonuses(mockDuoTeam, members);
        expect(bonuses[0].isActive).toBe(true); // Level 1
    });

    it('all levels inactive for invalid size', () => {
        const members = [{ name: 'UnitA' }]; // Only 1 member for DUO
        const bonuses = getFireteamBonuses(mockDuoTeam, members);
        expect(bonuses[0].isActive).toBe(false);
    });

    it('higher levels require matching members', () => {
        const members = [
            { name: 'Test' },
            { name: 'Test' },
            { name: 'Test' },
            { name: 'Test' },
            { name: 'Test' },
        ];
        const bonuses = getFireteamBonuses(mockCoreTeam, members);
        expect(bonuses[4].isActive).toBe(true); // Level 5
    });

    it('level 5 bonus grants Sixth Sense', () => {
        const bonuses = getFireteamBonuses(mockCoreTeam, []);
        expect(bonuses[4].description).toContain('Sixth Sense');
    });
});
