import { describe, it, expect } from 'vitest';
import {
    listSimilarity,
    unitIdentitySimilarity,
    compositionSimilarity,
    capabilitySimilarity,
    capabilityDiff,
    unitDiff,
    SAME_FACTION_WEIGHTS,
    CROSS_FACTION_WEIGHTS,
} from './list-similarity';
import type { ArmyList, ListUnit } from './listTypes';
import type { Unit } from './types';
import type { ProcessedUnit } from './game-model';
import type { ClassifiedObjective } from './classifieds';

interface MockOption {
    id: number;
    points: number;
    weapons?: number[];
    skills?: number[];
    equipment?: number[];
}

function makeUnit(id: number, isc: string, unitType: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 1, options: MockOption[] = [{ id: 1, points: 25 }]): Unit {
    const raw = {
        id,
        isc,
        name: isc,
        slug: isc.toLowerCase().replace(/\s+/g, '-'),
        factionIds: [101],
        profileGroups: [
            {
                id: 1,
                isc,
                category: 1,
                isPeripheral: false,
                isFTO: false,
                profiles: [{
                    id: 1, name: 'P', unitType, skills: [], equipment: [], weapons: [],
                    move: [4, 4], cc: 13, bs: 12, ph: 10, wip: 14, arm: 3, bts: 0, w: 1, s: 2,
                    isStructure: false, ava: 8, characteristics: [],
                }],
                options: options.map(o => ({
                    id: o.id, name: `Opt-${o.id}`, points: o.points, swc: 0, minis: 1,
                    skills: (o.skills ?? []).map(sid => ({ id: sid, name: `s${sid}`, modifiers: [], displayName: `s${sid}` })),
                    equipment: (o.equipment ?? []).map(eid => ({ id: eid, name: `e${eid}`, modifiers: [], displayName: `e${eid}` })),
                    weapons: (o.weapons ?? []).map(wid => ({ id: wid, name: `w${wid}`, modifiers: [], displayName: `w${wid}` })),
                    orders: [],
                })),
            },
        ],
        allWeaponIds: [],
        allSkillIds: [],
        allEquipmentIds: [],
        pointsRange: [
            Math.min(...options.map(o => o.points)),
            Math.max(...options.map(o => o.points)),
        ] as [number, number],
        hasPeripherals: false,
    } as unknown as ProcessedUnit;
    return {
        id: raw.id,
        isc: raw.isc,
        name: raw.name,
        factions: raw.factionIds,
        allWeaponIds: new Set(raw.allWeaponIds),
        allSkillIds: new Set(raw.allSkillIds),
        allEquipmentIds: new Set(raw.allEquipmentIds),
        allItemsWithMods: [],
        pointsRange: raw.pointsRange,
        raw,
    };
}

let counter = 0;
function lu(unit: Unit, optionId = 1): ListUnit {
    const opt = unit.raw.profileGroups[0].options.find(o => o.id === optionId)!;
    return {
        id: `lu-${++counter}`,
        unitId: unit.id,
        unit,
        profileGroupId: 1,
        profileId: 1,
        optionId,
        points: opt.points,
        swc: 0,
    };
}

function makeList(name: string, units: ListUnit[]): ArmyList {
    return {
        id: `list-${name}`,
        name,
        tags: [],
        factionId: 101,
        pointsLimit: 300,
        swcLimit: 6,
        groups: [{ id: 'g1', name: 'Combat Group 1', units }],
        createdAt: 0,
        updatedAt: 0,
    };
}

const NO_CLASSIFIEDS: ClassifiedObjective[] = [];
const opts = { classifieds: NO_CLASSIFIEDS };

describe('list-similarity', () => {
    const fusilier = makeUnit(1, 'Fusilier', 1, [{ id: 1, points: 10 }]);
    const aquila = makeUnit(2, 'Aquila Guard', 3, [{ id: 1, points: 50 }]);
    const swiss = makeUnit(3, 'Swiss Guard', 3, [{ id: 1, points: 70 }]);

    it('identity: a vs a = 1', () => {
        const a = makeList('A', [lu(fusilier), lu(aquila)]);
        const r = listSimilarity(a, a, opts);
        expect(r.composite).toBeCloseTo(1);
        expect(r.components.identity).toBeCloseTo(1);
        expect(r.components.composition).toBeCloseTo(1);
        expect(r.components.strategic).toBeCloseTo(1);
    });

    it('symmetry: sim(a,b) === sim(b,a)', () => {
        const a = makeList('A', [lu(fusilier), lu(aquila)]);
        const b = makeList('B', [lu(fusilier), lu(swiss)]);
        const s1 = listSimilarity(a, b, opts);
        const s2 = listSimilarity(b, a, opts);
        expect(s1.composite).toBeCloseTo(s2.composite);
        expect(s1.components.identity).toBeCloseTo(s2.components.identity);
        expect(s1.components.composition).toBeCloseTo(s2.components.composition);
        expect(s1.components.strategic).toBeCloseTo(s2.components.strategic);
    });

    it('bounds: composite and components ∈ [0, 1]', () => {
        const a = makeList('A', [lu(fusilier)]);
        const b = makeList('B', [lu(aquila), lu(swiss)]);
        const s = listSimilarity(a, b, opts);
        for (const v of [s.composite, s.components.identity, s.components.composition, s.components.strategic]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('disjoint identity = 0', () => {
        const a = makeList('A', [lu(fusilier)]);
        const b = makeList('B', [lu(aquila)]);
        expect(unitIdentitySimilarity(a, b)).toBe(0);
    });

    it('points-weighting: a 50pt unit dominates a 10pt unit', () => {
        const a = makeList('A', [lu(fusilier), lu(aquila)]);
        const b = makeList('B', [lu(fusilier)]);
        const w = unitIdentitySimilarity(a, b, { pointsWeighted: true });
        const u = unitIdentitySimilarity(a, b, { pointsWeighted: false });
        // Weighted: shared = 10, union = 60 → ~0.167
        // Unweighted: shared = {fusilier}, union = {fusilier, aquila} → 0.5
        expect(w).toBeLessThan(u);
        expect(w).toBeCloseTo(10 / 60, 2);
        expect(u).toBeCloseTo(0.5, 2);
    });

    it('composition similarity: same unitTypes → 1', () => {
        const a = makeList('A', [lu(fusilier)]);
        const b = makeList('B', [lu(fusilier)]);
        expect(compositionSimilarity(a, b)).toBeCloseTo(1);
    });

    it('unitDiff partitions correctly', () => {
        const a = makeList('A', [lu(fusilier), lu(aquila)]);
        const b = makeList('B', [lu(fusilier), lu(swiss)]);
        const diff = unitDiff(a, b);
        expect(diff.shared.map(e => e.isc)).toEqual(['Fusilier']);
        expect(diff.onlyInA.map(e => e.isc)).toEqual(['Aquila Guard']);
        expect(diff.onlyInB.map(e => e.isc)).toEqual(['Swiss Guard']);
    });

    it('empty lists return composite 1.0 (degenerate identity)', () => {
        const a = makeList('A', []);
        const b = makeList('B', []);
        const r = listSimilarity(a, b, opts);
        expect(r.composite).toBeCloseTo(1);
    });

    describe('capability (A4)', () => {
        const hmgUnit = makeUnit(10, 'HMG Unit', 3, [{ id: 1, points: 30, weapons: [100], skills: [200] }]);
        const smokeUnit = makeUnit(11, 'Smoke Unit', 1, [{ id: 1, points: 20, weapons: [101], skills: [201] }]);
        const sharedToolsUnit = makeUnit(12, 'Shared Tools', 1, [{ id: 1, points: 25, weapons: [100], skills: [200] }]);

        it('identical capability sets → 1', () => {
            const a = makeList('A', [lu(hmgUnit)]);
            const b = makeList('B', [lu(hmgUnit)]);
            expect(capabilitySimilarity(a, b)).toBeCloseTo(1);
        });

        it('disjoint capabilities → 0', () => {
            const a = makeList('A', [lu(hmgUnit)]);
            const b = makeList('B', [lu(smokeUnit)]);
            expect(capabilitySimilarity(a, b)).toBe(0);
        });

        it('cross-faction-style: same tools, different units → high capability, zero identity', () => {
            // Same weapon (100) + skill (200) but different ISC and slightly different points.
            // Identity registers 0 (different ISCs); capability registers high.
            const a = makeList('A', [lu(hmgUnit)]);
            const b = makeList('B', [lu(sharedToolsUnit)]);
            expect(unitIdentitySimilarity(a, b)).toBe(0);
            expect(capabilitySimilarity(a, b)).toBeGreaterThan(0.7);
            // With unweighted Jaccard the tag sets are identical → exactly 1.
            expect(capabilitySimilarity(a, b, { pointsWeighted: false })).toBeCloseTo(1);
        });

        it('capabilityDiff partitions tags by ownership', () => {
            const a = makeList('A', [lu(hmgUnit)]);          // weapon:100, skill:200
            const b = makeList('B', [lu(smokeUnit)]);         // weapon:101, skill:201
            const d = capabilityDiff(a, b);
            expect(d.shared).toEqual([]);
            expect(d.onlyInA.map(e => e.key).sort()).toEqual(['s:200', 'w:100']);
            expect(d.onlyInB.map(e => e.key).sort()).toEqual(['s:201', 'w:101']);
        });

        it('cross-faction weights drop identity, boost capability', () => {
            const a = makeList('A', [lu(hmgUnit)]);
            const b = makeList('B', [lu(sharedToolsUnit)]);
            const same = listSimilarity(a, b, opts, SAME_FACTION_WEIGHTS).composite;
            const cross = listSimilarity(a, b, opts, CROSS_FACTION_WEIGHTS).composite;
            // Cross-faction mode should reward shared tools more strongly when ISCs differ.
            expect(cross).toBeGreaterThan(same);
        });
    });
});
