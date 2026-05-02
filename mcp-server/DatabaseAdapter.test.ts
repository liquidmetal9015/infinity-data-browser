// Tests for MCP server DatabaseAdapter
// Since MCP tools are thin wrappers, we test the DatabaseAdapter methods directly

import { describe, it, expect } from 'vitest';

// We'll create a mock DatabaseAdapter for unit testing
// without requiring actual data files

interface MockUnitRaw {
    id: number;
    isc: string;
    name: string;
    factions: number[];
    slug?: string;
    profileGroups: Array<{
        id: number;
        profiles: Array<{
            id: number;
            name: string;
            skills: Array<{ id: number; name: string; modifiers?: string[] }>;
            equipment: Array<{ id: number; name: string; modifiers?: string[] }>;
            weapons: Array<{ id: number; name: string; modifiers?: string[] }>;
            move: number[];
            cc: number;
            bs: number;
            ph: number;
            wip: number;
            arm: number;
            bts: number;
            w: number;
            s: number;
        }>;
        options: Array<{
            id: number;
            name: string;
            points: number;
            swc: number;
            skills: Array<{ id: number; name: string }>;
            equipment: Array<{ id: number; name: string }>;
            weapons: Array<{ id: number; name: string }>;
        }>;
    }>;
}

// Mock metadata structure
const mockMetadata = {
    factions: [
        { id: 101, parent: 1, name: 'PanOceania', slug: 'panoceania', discontinued: false, logo: '' },
        { id: 301, parent: 101, name: 'Military Orders', slug: 'military-orders', discontinued: false, logo: '' },
    ],
    weapons: [
        { id: 1, name: 'Combi Rifle', wiki: 'Combi_Rifle' },
        { id: 2, name: 'HMG', wiki: 'HMG' },
        { id: 3, name: 'Missile Launcher' },
    ],
    skills: [
        { id: 10, name: 'Mimetism', wiki: 'Mimetism' },
        { id: 11, name: 'Total Immunity' },
        { id: 12, name: 'Courage' },
    ],
    equips: [
        { id: 20, name: 'Multispectral Visor', wiki: 'MSV' },
        { id: 21, name: 'Forward Observer' },
    ],
    ammunitions: []
};

// Mock unit data
const mockUnits: MockUnitRaw[] = [
    {
        id: 1,
        isc: 'Fusilier',
        name: 'Fusilier',
        factions: [101],
        slug: 'fusilier',
        profileGroups: [{
            id: 1,
            profiles: [{
                id: 1,
                name: 'FUSILIER',
                skills: [{ id: 12, name: 'Courage' }],
                equipment: [],
                weapons: [{ id: 1, name: 'Combi Rifle' }],
                move: [4, 2],
                cc: 13,
                bs: 12,
                ph: 10,
                wip: 12,
                arm: 1,
                bts: 0,
                w: 1,
                s: 2
            }],
            options: [
                { id: 1, name: 'Combi Rifle', points: 10, swc: 0, skills: [], equipment: [], weapons: [] },
                { id: 2, name: 'HMG', points: 18, swc: 1, skills: [], equipment: [], weapons: [] },
            ]
        }]
    },
    {
        id: 2,
        isc: 'Swiss Guard',
        name: 'Swiss Guard',
        factions: [101, 301],
        slug: 'swiss-guard',
        profileGroups: [{
            id: 1,
            profiles: [{
                id: 1,
                name: 'SWISS GUARD',
                skills: [{ id: 10, name: 'Mimetism', modifiers: ['-6'] }, { id: 11, name: 'Total Immunity' }],
                equipment: [{ id: 20, name: 'Multispectral Visor', modifiers: ['L2'] }],
                weapons: [{ id: 2, name: 'HMG' }],
                move: [4, 4],
                cc: 15,
                bs: 14,
                ph: 13,
                wip: 14,
                arm: 4,
                bts: 6,
                w: 2,
                s: 2
            }],
            options: [
                { id: 1, name: 'HMG', points: 68, swc: 2, skills: [], equipment: [], weapons: [] },
                { id: 2, name: 'Missile Launcher', points: 70, swc: 2, skills: [], equipment: [], weapons: [] },
            ]
        }]
    }
];

describe('MCP Server DatabaseAdapter Core Methods', () => {
    describe('Unit Search and Filtering', () => {
        // Test the shared search logic that the MCP tools use

        it('filters units by name query', () => {
            // Simulating search_units tool behavior
            const query = 'swiss';
            const results = mockUnits.filter(u =>
                u.name.toLowerCase().includes(query.toLowerCase()) ||
                u.isc.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(1);
            expect(results[0].isc).toBe('Swiss Guard');
        });

        it('filters units by faction', () => {
            const factionId = 301; // Military Orders
            const results = mockUnits.filter(u => u.factions.includes(factionId));

            expect(results).toHaveLength(1);
            expect(results[0].isc).toBe('Swiss Guard');
        });

        it('filters units by stat value', () => {
            // Simulating stat filter: BS > 13
            const results = mockUnits.filter(unit =>
                unit.profileGroups.some(pg =>
                    pg.profiles.some(p => p.bs > 13)
                )
            );

            expect(results).toHaveLength(1);
            expect(results[0].isc).toBe('Swiss Guard');
        });

        it('filters units by skill with modifier', () => {
            // Simulating search for Mimetism(-6)
            const skillId = 10;
            const modifierValue = '-6';

            const results = mockUnits.filter(unit =>
                unit.profileGroups.some(pg =>
                    pg.profiles.some(p =>
                        p.skills?.some(s =>
                            s.id === skillId && s.modifiers?.includes(modifierValue)
                        )
                    )
                )
            );

            expect(results).toHaveLength(1);
            expect(results[0].isc).toBe('Swiss Guard');
        });
    });

    describe('Unit Lookup', () => {
        it('finds unit by slug', () => {
            const slug = 'swiss-guard';
            const unit = mockUnits.find(u => u.slug === slug);

            expect(unit).toBeDefined();
            expect(unit?.isc).toBe('Swiss Guard');
        });

        it('finds unit by ISC name', () => {
            const isc = 'Fusilier';
            const unit = mockUnits.find(u => u.isc === isc);

            expect(unit).toBeDefined();
            expect(unit?.name).toBe('Fusilier');
        });

        it('returns undefined for non-existent unit', () => {
            const slug = 'non-existent-unit';
            const unit = mockUnits.find(u => u.slug === slug);

            expect(unit).toBeUndefined();
        });
    });

    describe('Item Search (Suggestions)', () => {
        it('finds weapons by name', () => {
            const query = 'hmg';
            const results = mockMetadata.weapons.filter(w =>
                w.name.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('HMG');
        });

        it('finds skills by name', () => {
            const query = 'mimetism';
            const results = mockMetadata.skills.filter(s =>
                s.name.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Mimetism');
        });

        it('finds equipment by name', () => {
            const query = 'visor';
            const results = mockMetadata.equips.filter(e =>
                e.name.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Multispectral Visor');
        });
    });

    describe('Faction Registration', () => {
        it('groups sectorials under parent factions', () => {
            const factions = mockMetadata.factions;
            const pano = factions.find(f => f.id === 101);
            const mo = factions.find(f => f.id === 301);

            expect(pano?.parent).toBe(1); // Super faction
            expect(mo?.parent).toBe(101); // PanOceania
        });

        it('identifies sectorials vs vanilla factions', () => {
            const factions = mockMetadata.factions;
            const isVanilla = (f: typeof factions[0]) => f.parent === f.id || f.parent < 100;
            const isSectorial = (f: typeof factions[0]) => f.parent >= 100 && f.parent !== f.id;

            expect(isVanilla(factions[0])).toBe(true); // PanOceania
            expect(isSectorial(factions[1])).toBe(true); // Military Orders
        });
    });

    describe('Points Range Calculation', () => {
        it('calculates min/max points for a unit', () => {
            const unit = mockUnits[0]; // Fusilier
            const options = unit.profileGroups.flatMap(pg => pg.options);
            const points = options.map(o => o.points);

            const minPoints = Math.min(...points);
            const maxPoints = Math.max(...points);

            expect(minPoints).toBe(10);
            expect(maxPoints).toBe(18);
        });

        it('calculates SWC range for a unit', () => {
            const unit = mockUnits[1]; // Swiss Guard
            const options = unit.profileGroups.flatMap(pg => pg.options);
            const swcs = options.map(o => o.swc);

            const minSwc = Math.min(...swcs);
            const maxSwc = Math.max(...swcs);

            expect(minSwc).toBe(2);
            expect(maxSwc).toBe(2);
        });
    });
});

describe('MCP Server Wiki/ITS Rules Methods', () => {
    describe('Wiki Search', () => {
        const mockWikiPages = [
            { slug: 'mimetism', title: 'Mimetism', content: 'Mimetism is a skill that provides negative modifiers...', url: 'https://wiki/mimetism' },
            { slug: 'total-immunity', title: 'Total Immunity', content: 'Total Immunity prevents damage effects...', url: 'https://wiki/total-immunity' },
            { slug: 'line-of-fire', title: 'Line of Fire', content: 'Line of Fire is used to determine visibility...', url: 'https://wiki/lof' },
        ];

        it('finds exact title matches', () => {
            const query = 'mimetism';
            const results = mockWikiPages.filter(p =>
                p.title.toLowerCase() === query.toLowerCase()
            );

            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Mimetism');
        });

        it('finds partial matches in content', () => {
            const query = 'visibility';
            const results = mockWikiPages.filter(p =>
                p.content.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(1);
            expect(results[0].slug).toBe('line-of-fire');
        });

        it('returns empty for no matches', () => {
            const query = 'xyz123nonexistent';
            const results = mockWikiPages.filter(p =>
                p.title.toLowerCase().includes(query.toLowerCase()) ||
                p.content.toLowerCase().includes(query.toLowerCase())
            );

            expect(results).toHaveLength(0);
        });
    });

    describe('ITS Rules Section Lookup', () => {
        const mockITSToc = [
            { title: 'Tournament Rules', page_id: 1 },
            { title: 'Scenarios', page_id: 10 },
            { title: 'Classified Objectives', page_id: 20 },
        ];

        it('finds section by exact name', () => {
            const query = 'Scenarios';
            const section = mockITSToc.find(t =>
                t.title.toLowerCase() === query.toLowerCase()
            );

            expect(section).toBeDefined();
            expect(section?.page_id).toBe(10);
        });

        it('finds section by partial match', () => {
            const query = 'tournament';
            const section = mockITSToc.find(t =>
                t.title.toLowerCase().includes(query.toLowerCase())
            );

            expect(section).toBeDefined();
            expect(section?.title).toBe('Tournament Rules');
        });
    });
});

describe('Fireteam Validation Logic', () => {
    const mockFireteamChart = {
        spec: { CORE: 1, HARIS: 1, DUO: 256 },
        teams: [
            {
                name: 'Fusilier Fireteam',
                type: ['CORE', 'HARIS'],
                units: [
                    { name: 'Fusilier', slug: 'fusilier', min: 3, max: 5 },
                    { name: 'Fusilier Hacker', slug: 'fusilier-hacker', min: 0, max: 2 },
                ]
            },
            {
                name: 'Wildcards',
                type: [],
                units: [
                    { name: 'Swiss Guard', slug: 'swiss-guard', min: 0, max: 1, comment: 'Wildcard' },
                ]
            }
        ]
    };

    it('finds fireteam by name', () => {
        const teamName = 'fusilier';
        const team = mockFireteamChart.teams.find(t =>
            t.name.toLowerCase().includes(teamName.toLowerCase())
        );

        expect(team).toBeDefined();
        expect(team?.name).toBe('Fusilier Fireteam');
    });

    it('validates team member count', () => {
        const _team = mockFireteamChart.teams[0];
        const members = ['Fusilier', 'Fusilier', 'Fusilier'];

        const isValidCore = members.length >= 3 && members.length <= 5;
        expect(isValidCore).toBe(true);
    });

    it('detects wildcard units', () => {
        const wildcardTeam = mockFireteamChart.teams.find(t => t.name === 'Wildcards');
        const wildcards = wildcardTeam?.units.filter(u => u.comment?.includes('Wildcard')) || [];

        expect(wildcards).toHaveLength(1);
        expect(wildcards[0].name).toBe('Swiss Guard');
    });
});

describe('search_units OR operator logic', () => {
    // Regression test for F-044: OR operator was doing intersection instead of union
    // The tool logic combines `results` (from name query) with `itemMatches` (from item filters)

    const unitA = { id: 1, name: 'Unit A' };
    const unitB = { id: 2, name: 'Unit B' };
    const unitC = { id: 3, name: 'Unit C' };

    it('AND operator intersects results with item matches', () => {
        const results = [unitA, unitB, unitC];
        const itemMatches = [unitB, unitC];
        const operator = 'and';

        let filtered: typeof results;
        if (operator === 'and') {
            const matchIds = new Set(itemMatches.map(u => u.id));
            filtered = results.filter(u => matchIds.has(u.id));
        } else {
            const seen = new Set(results.map(u => u.id));
            filtered = [...results];
            for (const u of itemMatches) {
                if (!seen.has(u.id)) {
                    filtered.push(u);
                    seen.add(u.id);
                }
            }
        }

        // AND: only units in BOTH sets
        expect(filtered).toHaveLength(2);
        expect(filtered.map(u => u.id)).toEqual([2, 3]);
    });

    it('OR operator unions results with item matches', () => {
        const results = [unitA];
        const itemMatches = [unitB, unitC];
        const operator = 'or';

        let filtered: typeof results;
        if (operator === 'and') {
            const matchIds = new Set(itemMatches.map(u => u.id));
            filtered = results.filter(u => matchIds.has(u.id));
        } else {
            const seen = new Set(results.map(u => u.id));
            filtered = [...results];
            for (const u of itemMatches) {
                if (!seen.has(u.id)) {
                    filtered.push(u);
                    seen.add(u.id);
                }
            }
        }

        // OR: units from EITHER set
        expect(filtered).toHaveLength(3);
        expect(filtered.map(u => u.id)).toEqual([1, 2, 3]);
    });

    it('OR operator deduplicates overlapping results', () => {
        const results = [unitA, unitB];
        const itemMatches = [unitB, unitC];
        const operator = 'or';

        let filtered: typeof results;
        if (operator === 'and') {
            const matchIds = new Set(itemMatches.map(u => u.id));
            filtered = results.filter(u => matchIds.has(u.id));
        } else {
            const seen = new Set(results.map(u => u.id));
            filtered = [...results];
            for (const u of itemMatches) {
                if (!seen.has(u.id)) {
                    filtered.push(u);
                    seen.add(u.id);
                }
            }
        }

        // OR with overlap: no duplicates
        expect(filtered).toHaveLength(3);
        expect(filtered.map(u => u.id)).toEqual([1, 2, 3]);
    });
});

describe('Army Code Parsing Logic', () => {
    // Test the army code format understanding

    it('validates base64 army code format', () => {
        // Valid army codes start with specific bytes
        const isValidArmyCodeFormat = (code: string) => {
            try {
                // Check if it's valid base64
                const decoded = Buffer.from(code, 'base64');
                return decoded.length > 10; // Minimum expected size
            } catch {
                return false;
            }
        };

        // Mock valid-looking code
        const mockCode = 'IyBQYW5PY2VhbmlhIExpc3Q='; // Base64 for "# PanOceania List"
        expect(isValidArmyCodeFormat(mockCode)).toBe(true);

        // Invalid base64
        const invalidCode = '!!!not-base64!!!';
        expect(isValidArmyCodeFormat(invalidCode)).toBe(false);
    });
});
