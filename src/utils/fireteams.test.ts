import { describe, it, expect } from 'vitest';
import { getUnitTags, calculateFireteamLevel, getFireteamBonuses } from '@shared/fireteams';
import type { Fireteam } from '@shared/types';

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
    const mockFusilierTeam: Fireteam = {
        name: 'Fusilier Fireteam',
        type: ['CORE'],
        units: [{ name: 'Fusilier', slug: 'fusilier', min: 0, max: 5 }],
    };

    it('returns 0 for empty team', () => {
        const level = calculateFireteamLevel(mockFusilierTeam, []);
        expect(level).toBe(0);
    });

    it('counts matching members for team level', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Fusilier' },
            { name: 'Fusilier' },
        ];
        const level = calculateFireteamLevel(mockFusilierTeam, members);
        expect(level).toBe(3);
    });

    it('does not count universal wildcards toward level', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Some Wildcard', comment: 'Wildcard' },
        ];
        const level = calculateFireteamLevel(mockFusilierTeam, members);
        expect(level).toBe(1); // Wildcard fills a slot but has no Fusilier identity
    });

    it('does not count non-matching members', () => {
        const members = [
            { name: 'Fusilier' },
            { name: 'Some Other Unit' },
        ];
        const level = calculateFireteamLevel(mockFusilierTeam, members);
        expect(level).toBe(0);
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

describe('Integration Scenarios', () => {
    const mockFennecTeam: Fireteam = {
        name: 'FENNECS Fireteam',
        type: ['HARIS', 'CORE'],
        units: [
            { min: 1, max: 5, name: 'FENNEC', slug: 'fennec-fusiliers' },
            { min: 0, max: 1, name: 'MAGISTRATE', slug: 'bca-magistrates' }
        ]
    };

    const mockColcorpTeam: Fireteam = {
        name: 'COLCORP Fireteams',
        type: ['DUO', 'HARIS'],
        units: [
            { min: 1, max: 2, name: 'MAGISTRATE', slug: 'bca-magistrates', comment: '(ColCorp)' },
            { min: 0, max: 2, name: 'JACKAL FTO', slug: 'minescorp-jackals', comment: '(ColCorp)' }
        ]
    };

    it('forms a valid ColCorp Haris of Level 3', () => {
        const members = [
            { name: 'BCA Magistrates', slug: 'bca-magistrates' },
            { name: 'Minescorp Jackals', slug: 'minescorp-jackals' },
            { name: 'Minescorp Jackals', slug: 'minescorp-jackals' }
        ];

        const bonuses = getFireteamBonuses(mockColcorpTeam, members);
        expect(bonuses[1].isActive).toBe(true); // Level 2 Bonus (Size 3)

        const level = calculateFireteamLevel(mockColcorpTeam, members);
        expect(level).toBe(3); // All 3 have ColCorp
    });

    it('forms a Fennec Haris with a universal wildcard', () => {
        const members = [
            { name: 'Fennec Fusiliers', slug: 'fennec-fusiliers' },
            { name: 'Fennec Fusiliers', slug: 'fennec-fusiliers' },
            { name: 'Crux Knight', slug: 'team-crux-father-knights', comment: 'wildcard' }
        ];

        const bonuses = getFireteamBonuses(mockFennecTeam, members);
        expect(bonuses[1].isActive).toBe(true); // Formed Size 3

        const level = calculateFireteamLevel(mockFennecTeam, members);
        expect(level).toBe(2); // Universal wildcard fills a slot but does not contribute to level
    });

    it('FTO units in a Fennec fireteam do not inflate the level beyond the Fennec count', () => {
        // Mirrors the real FENNECS Fireteam chart which has dedicated BLACK A.I.R. FTO slots
        const mockFennecFull: Fireteam = {
            name: 'FENNECS Fireteam',
            type: ['HARIS', 'CORE'],
            units: [
                { min: 1, max: 5, name: 'FENNEC', slug: 'fennec-fusiliers', comment: '' },
                { min: 0, max: 2, name: 'BLACK A.I.R. FTO', slug: 'black-a-i-r', comment: '' },
                { min: 0, max: 1, name: 'GRIFFIN', comment: '(Fennec)', slug: 'griffin-troops' },
                { min: 0, max: 1, name: 'MAGISTRATE', slug: 'bca-magistrates', comment: '' },
            ]
        };
        // BLACK A.I.R. FTO fills its own dedicated slot (not wildcard) — still not a Fennec
        // CRUX KNIGHT has comment:'wildcard' (injected by getMemberWithChartData from Wildcards chart)
        const members = [
            { name: 'BLACK A.I.R. FTO', slug: 'black-a-i-r', comment: '' },
            { name: 'FENNEC Fusiliers', slug: 'fennec-fusiliers', comment: '' },
            { name: 'FENNEC Fusiliers', slug: 'fennec-fusiliers', comment: '' },
            { name: 'CRUX KNIGHT', slug: 'team-crux-father-knights', comment: 'wildcard' },
        ];

        const level = calculateFireteamLevel(mockFennecFull, members);
        expect(level).toBe(2); // Only the two FENNECs share the Fennec identity
    });

    it('GRIFFIN + BIPANDRA (Fennec, Kestrel) forms a valid Kestrel Duo at level 2', () => {
        // Regression: slot comments like "(Kestrel)" were ignored when matching members to slots,
        // so BIPANDRA could not fill any KESTREL slot even though she has the Kestrel tag.
        const mockKestrelTeam: Fireteam = {
            name: 'KESTREL Fireteams',
            type: ['DUO', 'HARIS'],
            units: [
                { min: 0, max: 3, name: 'GRIFFIN', comment: '(Kestrel)', required: true, slug: 'griffin-troops' },
                { min: 0, max: 3, name: 'FIREFLY', comment: '(Kestrel)', required: true, slug: 'fireflies-clandestine-demo-squad' },
                { min: 0, max: 1, name: 'HETKARI', comment: '', required: true, slug: 'hetkari-shooters' },
            ]
        };
        const members = [
            { name: 'GRIFFIN', slug: 'griffin-troops', comment: '' },
            { name: 'BIPANDRA', slug: 'fusilier-indigo-bipandra', comment: '(Fennec, Kestrel)' },
        ];

        const bonuses = getFireteamBonuses(mockKestrelTeam, members);
        expect(bonuses[0].isActive).toBe(true); // Formed as a DUO

        const level = calculateFireteamLevel(mockKestrelTeam, members);
        expect(level).toBe(2); // Both units carry Kestrel identity
    });

    it('rejects a 2-man Fennec team since Fennec type is Haris/Core only', () => {
        const members = [
            { name: 'Fennec Fusiliers', slug: 'fennec-fusiliers' },
            { name: 'Fennec Fusiliers', slug: 'fennec-fusiliers' }
        ];

        const bonuses = getFireteamBonuses(mockFennecTeam, members);
        expect(bonuses[0].isActive).toBe(false); // Not formed, size minimum is 3 for Haris/Core
    });
});
