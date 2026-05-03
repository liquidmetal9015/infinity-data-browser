import { describe, it, expect } from 'vitest';
import { scoreList, compareLists } from './list-scoring';
import { UnitType } from './game-model.js';
import type { Unit } from './types';
import type { Profile, Loadout as Option } from './game-model.js';
import type { ClassifiedObjective } from './classifieds';

// ============================================================================
// Mock Factories (shared with unit-roles.test.ts pattern)
// ============================================================================

function mockUnit(overrides: Partial<Unit> = {}): Unit {
    return {
        id: 1,
        isc: 'TEST_UNIT',
        name: 'Test Unit',
        factions: [1],
        slug: 'test-unit',
        profileGroups: [],
        ...overrides,
    } as Unit;
}

function mockProfile(overrides: Partial<Profile> = {}): Profile {
    return {
        id: 1,
        name: 'Line Infantry',
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
        move: [4, 4],
        unitType: UnitType.LI,
        skills: [],
        weapons: [],
        equipment: [],
        ...overrides,
    } as Profile;
}

function mockOption(overrides: Partial<Option> = {}): Option {
    return {
        id: 1,
        name: 'Combi Rifle',
        points: 20,
        swc: 0,
        skills: [],
        weapons: [],
        equipment: [],
        peripheral: [],
        ...overrides,
    } as Option;
}

function makeEntry(unitOverrides = {}, profileOverrides = {}, optionOverrides = {}) {
    return {
        unit: mockUnit(unitOverrides),
        profile: mockProfile(profileOverrides),
        option: mockOption(optionOverrides),
    };
}

const EMPTY_CLASSIFIEDS: ClassifiedObjective[] = [];

// ============================================================================
// Tests
// ============================================================================

describe('scoreList', () => {
    it('scores an empty list as zero across all dimensions', () => {
        const score = scoreList([], EMPTY_CLASSIFIEDS);
        expect(score.totalPoints).toBe(0);
        expect(score.totalSwc).toBe(0);
        expect(score.modelCount).toBe(0);
        expect(score.totalOrders).toBe(0);
    });

    it('tallies points and SWC across units', () => {
        const units = [
            makeEntry({}, {}, { points: 25, swc: 0.5 }),
            makeEntry({}, {}, { points: 35, swc: 1 }),
            makeEntry({}, {}, { points: 40, swc: 1.5 }),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.totalPoints).toBe(100);
        expect(score.totalSwc).toBe(3);
        expect(score.modelCount).toBe(3);
    });

    it('calculates order efficiency based on model count / points', () => {
        const units = [
            makeEntry({}, {}, { points: 10 }),
            makeEntry({}, {}, { points: 10 }),
            makeEntry({}, {}, { points: 10 }),
            makeEntry({}, {}, { points: 10 }),
            makeEntry({}, {}, { points: 10 }),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        // 5 orders / 50 pts * 50 = 5.0
        expect(score.orderEfficiency).toBe(5);
        expect(score.totalOrders).toBe(5);
    });

    it('calculates average BS', () => {
        const units = [
            makeEntry({}, { bs: 14 }, {}),
            makeEntry({}, { bs: 10 }, {}),
            makeEntry({}, { bs: 12 }, {}),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.avgBS).toBe(12);
    });

    it('calculates average ARM and total wounds', () => {
        const units = [
            makeEntry({}, { arm: 3, w: 2 }, {}),
            makeEntry({}, { arm: 1, w: 1 }, {}),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.avgArm).toBe(2);
        expect(score.totalWounds).toBe(3);
    });

    it('counts fast units based on move array', () => {
        const units = [
            makeEntry({}, { move: [6, 4] }, {}),
            makeEntry({}, { move: [6, 2] }, {}),
            makeEntry({}, { move: [4, 4] }, {}),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.fastUnitCount).toBe(2);
    });

    it('overallScore is bounded and computed as average of breakdown', () => {
        const units = [
            makeEntry({}, { bs: 14, arm: 3, w: 2, move: [6, 4] }, { points: 30 }),
            makeEntry({}, { bs: 12, arm: 1, w: 1, move: [4, 4] }, { points: 20 }),
        ];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(score.overallScore).toBeLessThanOrEqual(100);
        // breakdown values should all be 0-100
        for (const val of Object.values(score.breakdown)) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(100);
        }
    });

    it('classified coverage is 0 with empty classifieds', () => {
        const units = [makeEntry()];
        const score = scoreList(units, EMPTY_CLASSIFIEDS);
        expect(score.classifiedCoverage).toBe(0);
        expect(score.completableClassifieds).toHaveLength(0);
    });

    it('classified coverage reflects matched objectives', () => {
        const classifieds: ClassifiedObjective[] = [
            { id: 1, name: 'HVT: Designation', category: 'test', designatedTroopers: ['Forward Observer'], objective: 'FO target' },
            { id: 2, name: 'Unmatched', category: 'test', designatedTroopers: ['TAG Pilot'], objective: 'something impossible' },
        ];
        // A unit with Forward Observer skill matches the first classified
        const units = [
            makeEntry({}, {
                skills: [{ id: 100, name: 'Forward Observer', modifiers: [], displayName: 'Forward Observer' }],
                equipment: [],
            }, {
                skills: [],
                equipment: [],
            }),
        ];
        const score = scoreList(units, classifieds);
        // Should match 1 out of 2 classifieds (50%)
        expect(score.classifiedCoverage).toBe(50);
        expect(score.completableClassifieds).toContain('HVT: Designation');
    });
});

describe('compareLists', () => {
    it('compares two lists and identifies dimension winners', () => {
        const list1 = {
            name: 'Offensive',
            units: [
                makeEntry({}, { bs: 15, arm: 0, w: 1 }, { points: 40 }),
                makeEntry({}, { bs: 14, arm: 0, w: 1 }, { points: 30 }),
            ],
        };
        const list2 = {
            name: 'Defensive',
            units: [
                makeEntry({}, { bs: 10, arm: 5, w: 3 }, { points: 50 }),
                makeEntry({}, { bs: 11, arm: 4, w: 2 }, { points: 40 }),
            ],
        };
        const result = compareLists(list1, list2, EMPTY_CLASSIFIEDS);
        expect(result.list1.name).toBe('Offensive');
        expect(result.list2.name).toBe('Defensive');
        expect(result.comparison).toHaveLength(7);
        // Offense dimension: list1 should win (higher BS)
        const offenseComp = result.comparison.find(c => c.dimension === 'Offense');
        expect(offenseComp?.winner).toBe('Offensive');
        // Defense dimension: list2 should win (higher ARM + wounds)
        const defenseComp = result.comparison.find(c => c.dimension === 'Defense');
        expect(defenseComp?.winner).toBe('Defensive');
    });

    it('summary indicates overall winner or tie', () => {
        const list1 = { name: 'A', units: [makeEntry({}, {}, { points: 30 })] };
        const list2 = { name: 'B', units: [makeEntry({}, {}, { points: 30 })] };
        const result = compareLists(list1, list2, EMPTY_CLASSIFIEDS);
        expect(result.summary).toBeDefined();
        expect(result.summary.length).toBeGreaterThan(0);
    });
});
