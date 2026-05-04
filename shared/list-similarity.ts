// list-similarity.ts — Compare army lists by similarity / distance.
//
// Produces a composite similarity score in [0, 1] from a pluggable set of
// component metrics, plus a unit-level diff. Tier 1 ships A1 (identity),
// A2 (composition), A3 (strategic profile). A4 (capability) is reserved for
// cross-faction comparison and currently returns 0 with weight 0.

import type { ArmyList, ListUnit } from './listTypes';
import { getUnitDetails } from './listTypes';
import type { Unit } from './types';
import type { Profile, Loadout, ProfileCategoryId } from './game-model';
import type { UnitRole } from './unit-roles';
import { classifyUnit } from './unit-roles';
import type { ClassifiedObjective } from './classifieds';
import { scoreList, type ListScore } from './list-scoring';

export interface ResolvedListUnit {
    listUnit: ListUnit;
    unit: Unit;
    profile: Profile;
    option: Loadout;
    profileGroupCategory?: ProfileCategoryId;
}

/** Resolve all non-peripheral units in a list into {unit, profile, option} triples. */
export function resolveListUnits(list: ArmyList): ResolvedListUnit[] {
    const out: ResolvedListUnit[] = [];
    for (const group of list.groups) {
        for (const lu of group.units) {
            if (lu.isPeripheral) continue;
            const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
            if (!profile || !option) continue;
            const pg = lu.unit.raw.profileGroups.find(g => g.id === lu.profileGroupId);
            out.push({ listUnit: lu, unit: lu.unit, profile, option, profileGroupCategory: pg?.category });
        }
    }
    return out;
}

// ============================================================================
// A1 — Identity (points-weighted bag-Jaccard on ISC multiset)
// ============================================================================

function iscWeights(units: ResolvedListUnit[], pointsWeighted: boolean): Map<string, number> {
    const m = new Map<string, number>();
    for (const u of units) {
        const w = pointsWeighted ? Math.max(u.option.points, 1) : 1;
        m.set(u.unit.isc, (m.get(u.unit.isc) ?? 0) + w);
    }
    return m;
}

export function unitIdentitySimilarity(
    a: ArmyList,
    b: ArmyList,
    opts: { pointsWeighted?: boolean } = {}
): number {
    const ua = resolveListUnits(a);
    const ub = resolveListUnits(b);
    if (ua.length === 0 && ub.length === 0) return 1;
    const pw = opts.pointsWeighted ?? true;
    const wa = iscWeights(ua, pw);
    const wb = iscWeights(ub, pw);
    const keys = new Set([...wa.keys(), ...wb.keys()]);
    let minSum = 0;
    let maxSum = 0;
    for (const k of keys) {
        const x = wa.get(k) ?? 0;
        const y = wb.get(k) ?? 0;
        minSum += Math.min(x, y);
        maxSum += Math.max(x, y);
    }
    return maxSum === 0 ? 1 : minSum / maxSum;
}

// ============================================================================
// A2 — Composition (unitType + role distributions, cosine)
// ============================================================================

const UNIT_TYPE_KEYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const ROLE_KEYS: UnitRole[] = [
    'gunfighter', 'melee', 'specialist', 'button_pusher',
    'skirmisher', 'heavy', 'support', 'hack_target', 'order_generator',
];

function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 && nb === 0) return 1;
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function unitTypeVector(units: ResolvedListUnit[], pointsWeighted: boolean): number[] {
    const v = new Array(UNIT_TYPE_KEYS.length).fill(0);
    for (const u of units) {
        const idx = UNIT_TYPE_KEYS.indexOf(u.profile.unitType as typeof UNIT_TYPE_KEYS[number]);
        if (idx >= 0) v[idx] += pointsWeighted ? Math.max(u.option.points, 1) : 1;
    }
    return v;
}

function roleVector(units: ResolvedListUnit[], pointsWeighted: boolean): number[] {
    const v = new Array(ROLE_KEYS.length).fill(0);
    for (const u of units) {
        const role = classifyUnit(u.unit, u.profile, u.option).primaryRole;
        const idx = ROLE_KEYS.indexOf(role);
        if (idx >= 0) v[idx] += pointsWeighted ? Math.max(u.option.points, 1) : 1;
    }
    return v;
}

export function compositionSimilarity(
    a: ArmyList,
    b: ArmyList,
    opts: { pointsWeighted?: boolean } = {}
): number {
    const pw = opts.pointsWeighted ?? true;
    const ua = resolveListUnits(a);
    const ub = resolveListUnits(b);
    if (ua.length === 0 && ub.length === 0) return 1;
    const utSim = cosine(unitTypeVector(ua, pw), unitTypeVector(ub, pw));
    const roleSim = cosine(roleVector(ua, pw), roleVector(ub, pw));
    return (utSim + roleSim) / 2;
}

// ============================================================================
// A3 — Strategic profile (cosine on ListScore.breakdown)
// ============================================================================

export function breakdownVector(score: ListScore): number[] {
    // scoreList yields NaN on the classifieds axis when no objectives are loaded;
    // treat NaN as 0 so the cosine stays well-defined.
    const safe = (n: number) => (Number.isFinite(n) ? n : 0);
    return [
        safe(score.breakdown.offense),
        safe(score.breakdown.defense),
        safe(score.breakdown.orders),
        safe(score.breakdown.specialists),
        safe(score.breakdown.mobility),
        safe(score.breakdown.classifieds),
    ];
}

export function scoreFromList(list: ArmyList, classifieds: ClassifiedObjective[]): ListScore | null {
    const units = resolveListUnits(list);
    if (units.length === 0) return null;
    return scoreList(
        units.map(u => ({ unit: u.unit, profile: u.profile, option: u.option, profileGroupCategory: u.profileGroupCategory })),
        classifieds,
        list.pointsLimit
    );
}

export function strategicProfileSimilarity(
    a: ArmyList,
    b: ArmyList,
    classifieds: ClassifiedObjective[]
): number {
    const sa = scoreFromList(a, classifieds);
    const sb = scoreFromList(b, classifieds);
    if (!sa && !sb) return 1;
    if (!sa || !sb) return 0;
    return cosine(breakdownVector(sa), breakdownVector(sb));
}

// ============================================================================
// A4 — Capability (weighted Jaccard on weapon/skill/equipment IDs)
// ============================================================================

export type CapabilityKind = 'weapon' | 'skill' | 'equipment';
const KIND_PREFIX: Record<CapabilityKind, string> = { weapon: 'w', skill: 's', equipment: 'e' };
const PREFIX_KIND: Record<string, CapabilityKind> = { w: 'weapon', s: 'skill', e: 'equipment' };

function capabilityKey(kind: CapabilityKind, id: number): string {
    return `${KIND_PREFIX[kind]}:${id}`;
}

function parseCapabilityKey(key: string): { kind: CapabilityKind; id: number } {
    const idx = key.indexOf(':');
    return { kind: PREFIX_KIND[key.slice(0, idx)], id: parseInt(key.slice(idx + 1), 10) };
}

function capabilityWeights(units: ResolvedListUnit[], pointsWeighted: boolean): Map<string, number> {
    const m = new Map<string, number>();
    for (const u of units) {
        const w = pointsWeighted ? Math.max(u.option.points, 1) : 1;
        // De-dupe within a single unit so a profile + option that both list the same
        // weapon don't double-count.
        const seen = new Set<string>();
        const add = (kind: CapabilityKind, id: number) => {
            const key = capabilityKey(kind, id);
            if (seen.has(key)) return;
            seen.add(key);
            m.set(key, (m.get(key) ?? 0) + w);
        };
        for (const x of u.profile.weapons) add('weapon', x.id);
        for (const x of u.option.weapons) add('weapon', x.id);
        for (const x of u.profile.skills) add('skill', x.id);
        for (const x of u.option.skills) add('skill', x.id);
        for (const x of u.profile.equipment) add('equipment', x.id);
        for (const x of u.option.equipment) add('equipment', x.id);
    }
    return m;
}

export function capabilitySimilarity(
    a: ArmyList,
    b: ArmyList,
    opts: { pointsWeighted?: boolean } = {}
): number {
    const ua = resolveListUnits(a);
    const ub = resolveListUnits(b);
    if (ua.length === 0 && ub.length === 0) return 1;
    const pw = opts.pointsWeighted ?? true;
    const wa = capabilityWeights(ua, pw);
    const wb = capabilityWeights(ub, pw);
    const keys = new Set([...wa.keys(), ...wb.keys()]);
    let minSum = 0;
    let maxSum = 0;
    for (const k of keys) {
        const x = wa.get(k) ?? 0;
        const y = wb.get(k) ?? 0;
        minSum += Math.min(x, y);
        maxSum += Math.max(x, y);
    }
    return maxSum === 0 ? 1 : minSum / maxSum;
}

export interface CapabilityDiffEntry {
    key: string;
    kind: CapabilityKind;
    id: number;
    weightA: number;
    weightB: number;
}

export function capabilityDiff(
    a: ArmyList,
    b: ArmyList,
    opts: { pointsWeighted?: boolean } = {}
): {
    onlyInA: CapabilityDiffEntry[];
    shared: CapabilityDiffEntry[];
    onlyInB: CapabilityDiffEntry[];
} {
    const pw = opts.pointsWeighted ?? true;
    const wa = capabilityWeights(resolveListUnits(a), pw);
    const wb = capabilityWeights(resolveListUnits(b), pw);
    const keys = new Set([...wa.keys(), ...wb.keys()]);
    const entries: CapabilityDiffEntry[] = [];
    for (const k of keys) {
        const parsed = parseCapabilityKey(k);
        if (!parsed.kind) continue;
        entries.push({
            key: k,
            kind: parsed.kind,
            id: parsed.id,
            weightA: wa.get(k) ?? 0,
            weightB: wb.get(k) ?? 0,
        });
    }
    const sortByWeight = (x: CapabilityDiffEntry, y: CapabilityDiffEntry) =>
        (y.weightA + y.weightB) - (x.weightA + x.weightB);
    return {
        onlyInA: entries.filter(e => e.weightA > 0 && e.weightB === 0).sort(sortByWeight),
        shared: entries.filter(e => e.weightA > 0 && e.weightB > 0).sort(sortByWeight),
        onlyInB: entries.filter(e => e.weightA === 0 && e.weightB > 0).sort(sortByWeight),
    };
}

// ============================================================================
// Composite + registry
// ============================================================================

export interface SimilarityOptions {
    pointsWeighted?: boolean;
    classifieds: ClassifiedObjective[];
}

export interface SimilarityComponents {
    identity: number;       // A1
    composition: number;    // A2
    strategic: number;      // A3
    capability: number;     // A4 — weighted Jaccard on weapon/skill/equipment IDs
}

export interface SimilarityWeights {
    identity: number;
    composition: number;
    strategic: number;
    capability: number;
}

export const SAME_FACTION_WEIGHTS: SimilarityWeights = {
    identity: 0.20,
    composition: 0.25,
    strategic: 0.40,
    capability: 0.15,
};

export const CROSS_FACTION_WEIGHTS: SimilarityWeights = {
    identity: 0,
    composition: 0.20,
    strategic: 0.40,
    capability: 0.40,
};

export const DEFAULT_WEIGHTS: SimilarityWeights = SAME_FACTION_WEIGHTS;

export interface SimilarityResult {
    composite: number;
    components: SimilarityComponents;
    weights: SimilarityWeights;
}

export function listSimilarity(
    a: ArmyList,
    b: ArmyList,
    opts: SimilarityOptions,
    weights: SimilarityWeights = DEFAULT_WEIGHTS
): SimilarityResult {
    const components: SimilarityComponents = {
        identity: unitIdentitySimilarity(a, b, opts),
        composition: compositionSimilarity(a, b, opts),
        strategic: strategicProfileSimilarity(a, b, opts.classifieds),
        capability: capabilitySimilarity(a, b, opts),
    };
    const wsum = weights.identity + weights.composition + weights.strategic + weights.capability;
    const composite = wsum === 0 ? 0 : (
        components.identity * weights.identity +
        components.composition * weights.composition +
        components.strategic * weights.strategic +
        components.capability * weights.capability
    ) / wsum;
    return { composite, components, weights };
}

// ============================================================================
// Unit diff — keyed by (isc, profileGroupId, profileId, optionId)
// ============================================================================

export interface DiffEntry {
    key: string;
    isc: string;
    profileGroupId: number;
    profileId: number;
    optionId: number;
    unitName: string;
    profileName: string;
    optionName: string;
    points: number;
    countA: number;
    countB: number;
}

function entryKey(lu: ListUnit): string {
    return `${lu.unit.isc}|${lu.profileGroupId}|${lu.profileId}|${lu.optionId}`;
}

export function unitDiff(a: ArmyList, b: ArmyList): {
    onlyInA: DiffEntry[];
    shared: DiffEntry[];
    onlyInB: DiffEntry[];
} {
    const ua = resolveListUnits(a);
    const ub = resolveListUnits(b);
    const all = new Map<string, DiffEntry>();

    function ingest(side: 'A' | 'B', units: ResolvedListUnit[]) {
        for (const u of units) {
            const key = entryKey(u.listUnit);
            let e = all.get(key);
            if (!e) {
                e = {
                    key,
                    isc: u.unit.isc,
                    profileGroupId: u.listUnit.profileGroupId,
                    profileId: u.listUnit.profileId,
                    optionId: u.listUnit.optionId,
                    unitName: u.unit.name,
                    profileName: u.profile.name,
                    optionName: u.option.name,
                    points: u.option.points,
                    countA: 0,
                    countB: 0,
                };
                all.set(key, e);
            }
            if (side === 'A') e.countA++;
            else e.countB++;
        }
    }
    ingest('A', ua);
    ingest('B', ub);

    const sortFn = (x: DiffEntry, y: DiffEntry) =>
        x.unitName.localeCompare(y.unitName) || x.optionName.localeCompare(y.optionName);

    return {
        onlyInA: Array.from(all.values()).filter(e => e.countA > 0 && e.countB === 0).sort(sortFn),
        shared: Array.from(all.values()).filter(e => e.countA > 0 && e.countB > 0).sort(sortFn),
        onlyInB: Array.from(all.values()).filter(e => e.countA === 0 && e.countB > 0).sort(sortFn),
    };
}

// ============================================================================
// UI helpers — points-by-unitType buckets, role-distribution counts
// ============================================================================

export const UNIT_TYPE_LABELS: Record<number, string> = {
    1: 'LI', 2: 'MI', 3: 'HI', 4: 'TAG', 5: 'REM', 6: 'SK', 7: 'WB', 8: 'TURRET',
};

export function pointsByUnitType(list: ArmyList): Record<number, number> {
    const m: Record<number, number> = {};
    for (const u of resolveListUnits(list)) {
        m[u.profile.unitType] = (m[u.profile.unitType] ?? 0) + u.option.points;
    }
    return m;
}

export function roleDistribution(list: ArmyList): Record<UnitRole, number> {
    const out = Object.fromEntries(ROLE_KEYS.map(r => [r, 0])) as Record<UnitRole, number>;
    for (const u of resolveListUnits(list)) {
        const role = classifyUnit(u.unit, u.profile, u.option).primaryRole;
        out[role] = (out[role] ?? 0) + 1;
    }
    return out;
}

// ============================================================================
// List content indexer — used by search/filter UIs
// ============================================================================

export interface ListIndex {
    weaponIds: Set<number>;
    skillIds: Set<number>;
    equipmentIds: Set<number>;
    /** Lowercased unit names AND ISCs, both included so substring search hits either. */
    unitNames: Set<string>;
}

export function indexList(list: ArmyList): ListIndex {
    const idx: ListIndex = {
        weaponIds: new Set<number>(),
        skillIds: new Set<number>(),
        equipmentIds: new Set<number>(),
        unitNames: new Set<string>(),
    };
    for (const u of resolveListUnits(list)) {
        idx.unitNames.add(u.unit.name.toLowerCase());
        idx.unitNames.add(u.unit.isc.toLowerCase());
        for (const x of u.profile.weapons) idx.weaponIds.add(x.id);
        for (const x of u.option.weapons) idx.weaponIds.add(x.id);
        for (const x of u.profile.skills) idx.skillIds.add(x.id);
        for (const x of u.option.skills) idx.skillIds.add(x.id);
        for (const x of u.profile.equipment) idx.equipmentIds.add(x.id);
        for (const x of u.option.equipment) idx.equipmentIds.add(x.id);
    }
    return idx;
}

export const ROLE_LABELS: Record<UnitRole, string> = {
    gunfighter: 'Gunfighter',
    melee: 'Melee',
    specialist: 'Specialist',
    button_pusher: 'Button Pusher',
    skirmisher: 'Skirmisher',
    heavy: 'Heavy',
    support: 'Support',
    hack_target: 'Hack Target',
    order_generator: 'Order Source',
};
