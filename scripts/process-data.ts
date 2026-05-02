/**
 * ETL: Transform raw CB JSON → processed static JSON files
 *
 * Reads data/ directory (metadata.json + per-faction JSON files)
 * and writes data/processed/ with fully resolved unit data.
 *
 * Usage:
 *   npx tsx scripts/process-data.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
    ProcessedFactionFile,
    ProcessedMetadataFile,
    ProcessedFactionsFile,
    ProcessedFaction,
    ProcessedUnit,
    ProfileGroup,
    Profile,
    Loadout,
    OrderEntry,
    SkillInstance,
    EquipmentInstance,
    WeaponInstance,
    WeaponDefinition,
    SkillDefinition,
    EquipmentDefinition,
    AmmunitionDefinition,
    FactionFireteamChart,
    FireteamSpec,
    FireteamComposition,
    PeripheralInclude,
} from '../shared/game-model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const OUT_DIR = path.resolve(__dirname, '../data/processed');
const SCHEMA_VERSION = '2.0';
const PERIPHERAL_SKILL_ID = 243;
const MOVEMENT_CM_THRESHOLD = 10;
const MOVEMENT_CM_TO_INCHES = 0.4;

// ============================================================================
// Raw CB JSON types (input shape)
// ============================================================================

interface RawItemRef {
    id: number;
    extra?: number[];
    order?: number;
    q?: number;
}

interface RawProfile {
    id: number;
    name: string;
    type: number;
    ava: number;
    str: boolean;
    move: number[];
    cc: number;
    bs: number;
    ph: number;
    wip: number;
    arm: number;
    bts: number;
    w: number;
    s: number;
    chars: number[];
    skills: RawItemRef[];
    equip: RawItemRef[];
    weapons: RawItemRef[];
    peripheral: unknown[];
    notes?: string | null;
    logo?: string;
    includes?: unknown[];
}

interface RawOption {
    id: number;
    name: string;
    points: number;
    swc: string | number;
    minis: number;
    disabled: boolean;
    orders: Array<{ type: string; list: number; total: number }>;
    skills: RawItemRef[];
    equip: RawItemRef[];
    weapons: RawItemRef[];
    includes: PeripheralInclude[];
    chars: number[];
}

interface RawProfileGroup {
    id?: number;
    isc: string;
    notes?: string | null;
    profiles: RawProfile[];
    options: RawOption[];
}

interface RawUnit {
    id: number;
    idArmy?: number;
    canonical?: number;
    isc: string;
    iscAbbr?: string;
    name: string;
    slug: string;
    logo?: string;
    notes?: string | null;
    factions: number[];
    profileGroups: RawProfileGroup[];
    filters?: unknown;
}

interface RawExtra {
    id: number;
    name: string;
    type?: string;
}

interface RawFactionFile {
    version?: string;
    units: RawUnit[];
    fireteamChart?: RawFireteamChart | null;
    filters?: {
        extras?: RawExtra[];
        [key: string]: unknown;
    };
    relations?: unknown[];
    resume?: unknown[];
    specops?: unknown[];
    reinforcements?: unknown[];
    fireteams?: unknown;
}

interface RawFireteamChart {
    spec: { CORE?: number; HARIS?: number; DUO?: number; [k: string]: number | undefined };
    teams?: Array<{
        name: string;
        type: string[] | string;
        obs?: string;
        units: Array<{
            slug: string;
            isc?: string;
            name?: string;
            min: number;
            max: number;
            required?: boolean;
            comment?: string;
            obs?: string;
        }>;
    }>;
}

interface RawMetadata {
    factions: Array<{
        id: number;
        parent: number;
        name: string;
        slug: string;
        discontinued: boolean;
        logo: string;
    }>;
    weapons: Array<{
        id: number;
        name: string;
        wiki?: string;
        type?: string;
        burst?: string | number;
        damage?: string;
        saving?: string;
        savingNum?: string;
        ammunition?: number | null;
        properties?: string[];
        distance?: unknown;
    }>;
    skills: Array<{ id: number; name: string; wiki?: string }>;
    equips: Array<{ id: number; name: string; wiki?: string }>;
    ammunitions: Array<{ id: number; name: string; wiki?: string }>;
}

// ============================================================================
// Helper: build global extras map from all faction files
// ============================================================================

async function buildExtrasMap(
    factionSlugs: string[],
): Promise<{ extrasMap: Map<number, string>; distanceExtras: Set<number> }> {
    const extrasMap = new Map<number, string>();
    const distanceExtras = new Set<number>();

    for (const slug of factionSlugs) {
        const filePath = path.join(DATA_DIR, `${slug}.json`);
        try {
            const raw: RawFactionFile = JSON.parse(await fs.readFile(filePath, 'utf8'));
            for (const extra of raw.filters?.extras ?? []) {
                if (!extrasMap.has(extra.id)) {
                    extrasMap.set(extra.id, extra.name);
                    if (extra.type === 'DISTANCE') {
                        distanceExtras.add(extra.id);
                    }
                }
            }
        } catch {
            // File missing — skip
        }
    }

    return { extrasMap, distanceExtras };
}

// ============================================================================
// Helper: resolve item references → named instances
// ============================================================================

function resolveSkills(
    refs: RawItemRef[],
    skillsMap: Map<number, SkillDefinition>,
    extrasMap: Map<number, string>,
): SkillInstance[] {
    return refs.map(ref => {
        const def = skillsMap.get(ref.id);
        const name = def?.name ?? `Skill#${ref.id}`;
        const modifiers = (ref.extra ?? []).map(eid => extrasMap.get(eid) ?? `extra#${eid}`);
        const displayName = modifiers.length > 0 ? `${name}(${modifiers.join(', ')})` : name;
        return { id: ref.id, name, modifiers, displayName, wikiUrl: def?.wikiUrl };
    });
}

function resolveEquipment(
    refs: RawItemRef[],
    equipMap: Map<number, EquipmentDefinition>,
    extrasMap: Map<number, string>,
): EquipmentInstance[] {
    return refs.map(ref => {
        const def = equipMap.get(ref.id);
        const name = def?.name ?? `Equip#${ref.id}`;
        const modifiers = (ref.extra ?? []).map(eid => extrasMap.get(eid) ?? `extra#${eid}`);
        const displayName = modifiers.length > 0 ? `${name}(${modifiers.join(', ')})` : name;
        return { id: ref.id, name, modifiers, displayName, wikiUrl: def?.wikiUrl };
    });
}

function resolveWeapons(
    refs: RawItemRef[],
    weaponsMap: Map<number, WeaponDefinition>,
    extrasMap: Map<number, string>,
): WeaponInstance[] {
    return refs.map(ref => {
        const def = weaponsMap.get(ref.id);
        const name = def?.name ?? `Weapon#${ref.id}`;
        const modifiers = (ref.extra ?? []).map(eid => extrasMap.get(eid) ?? `extra#${eid}`);
        const displayName = modifiers.length > 0 ? `${name}(${modifiers.join(', ')})` : name;
        return { id: ref.id, name, modifiers, displayName, wikiUrl: def?.wikiUrl };
    });
}

// ============================================================================
// Helper: movement conversion
// ============================================================================

function convertMove(raw: number[]): [number, number] {
    const convert = (v: number) => (v >= MOVEMENT_CM_THRESHOLD ? Math.round(v * MOVEMENT_CM_TO_INCHES) : v);
    return [convert(raw[0] ?? 0), convert(raw[1] ?? 0)];
}

// ============================================================================
// Helper: detect peripheral type from skills
// ============================================================================

const PERIPHERAL_TYPE_EXTRA_MAP: Record<number, string> = {
    40: 'Synchronized',
    41: 'Servant',
    47: 'Control',
    322: 'Ancillary',
    374: 'Cyberplug',
};

function detectPeripheralType(skills: RawItemRef[]): string | undefined {
    const periSkill = skills.find(s => s.id === PERIPHERAL_SKILL_ID);
    if (!periSkill) return undefined;
    for (const extraId of periSkill.extra ?? []) {
        const type = PERIPHERAL_TYPE_EXTRA_MAP[extraId];
        if (type) return type;
    }
    return 'Synchronized'; // default if peripheral skill found but no type extra
}

// ============================================================================
// Core transform: RawProfile → Profile
// ============================================================================

function transformProfile(
    raw: RawProfile,
    skillsMap: Map<number, SkillDefinition>,
    equipMap: Map<number, EquipmentDefinition>,
    weaponsMap: Map<number, WeaponDefinition>,
    extrasMap: Map<number, string>,
): Profile {
    // Normalize ava=0 (data error) to -1 for peripheral profiles
    const periType = detectPeripheralType(raw.skills);
    const ava = raw.ava === 0 && periType !== undefined ? -1 : raw.ava;

    return {
        id: raw.id,
        name: raw.name,
        unitType: raw.type as Profile['unitType'],
        move: convertMove(raw.move ?? [0, 0]),
        cc: raw.cc,
        bs: raw.bs,
        ph: raw.ph,
        wip: raw.wip,
        arm: raw.arm,
        bts: raw.bts,
        w: raw.w,
        s: raw.s,
        isStructure: Boolean(raw.str),
        ava,
        characteristics: raw.chars ?? [],
        skills: resolveSkills(raw.skills ?? [], skillsMap, extrasMap),
        equipment: resolveEquipment(raw.equip ?? [], equipMap, extrasMap),
        weapons: resolveWeapons(raw.weapons ?? [], weaponsMap, extrasMap),
        ...(periType !== undefined ? { peripheralType: periType as Profile['peripheralType'] } : {}),
    };
}

// ============================================================================
// Core transform: RawOption → Loadout
// ============================================================================

function transformOption(
    raw: RawOption,
    skillsMap: Map<number, SkillDefinition>,
    equipMap: Map<number, EquipmentDefinition>,
    weaponsMap: Map<number, WeaponDefinition>,
    extrasMap: Map<number, string>,
): Loadout {
    const orders: OrderEntry[] = (raw.orders ?? []).map(o => ({
        type: o.type as OrderEntry['type'],
        inPool: o.list === 1,
        count: o.total ?? 1,
    }));

    const loadout: Loadout = {
        id: raw.id,
        name: raw.name,
        points: Number(raw.points) || 0,
        swc: parseFloat(String(raw.swc)) || 0,
        minis: raw.minis ?? 1,
        orders,
        skills: resolveSkills(raw.skills ?? [], skillsMap, extrasMap),
        equipment: resolveEquipment(raw.equip ?? [], equipMap, extrasMap),
        weapons: resolveWeapons(raw.weapons ?? [], weaponsMap, extrasMap),
    };

    if (raw.disabled) loadout.disabled = true;
    if (raw.includes?.length) loadout.includes = raw.includes;

    return loadout;
}

// ============================================================================
// Core transform: RawProfileGroup → ProfileGroup
// ============================================================================

function transformProfileGroup(
    raw: RawProfileGroup,
    pgIndex: number,
    skillsMap: Map<number, SkillDefinition>,
    equipMap: Map<number, EquipmentDefinition>,
    weaponsMap: Map<number, WeaponDefinition>,
    extrasMap: Map<number, string>,
): ProfileGroup {
    const profiles = (raw.profiles ?? []).map(p =>
        transformProfile(p, skillsMap, equipMap, weaponsMap, extrasMap),
    );

    const options = (raw.options ?? []).map(o =>
        transformOption(o, skillsMap, equipMap, weaponsMap, extrasMap),
    );

    // Peripheral detection: any profile has Peripheral skill
    const isPeripheral = profiles.some(p => p.peripheralType !== undefined);
    const peripheralType = profiles.find(p => p.peripheralType !== undefined)?.peripheralType;

    // FTO detection: ISC contains "FTO" or profile name contains "FTO"
    const isFTO = raw.isc?.includes('FTO') ||
        profiles.some(p => p.name?.includes('FTO'));

    // Category: from CB raw (filters.category on unit) — stored at profileGroup level as-is
    // We use 0 for peripherals and uncategorized, otherwise use the first non-zero value found
    // (CB raw doesn't store category per profile group; it's in filters.category on the unit)
    // We'll set it from the unit's filters at the caller level
    const category = 0; // placeholder — set by caller

    return {
        id: raw.id ?? pgIndex,
        isc: raw.isc,
        category,
        profiles,
        options,
        ...(raw.notes ? { notes: raw.notes } : {}),
        isPeripheral,
        ...(isPeripheral && peripheralType ? { peripheralType: peripheralType as ProfileGroup['peripheralType'] } : {}),
        isFTO,
    };
}

// ============================================================================
// Core transform: RawUnit → ProcessedUnit
// ============================================================================

function transformUnit(
    raw: RawUnit,
    skillsMap: Map<number, SkillDefinition>,
    equipMap: Map<number, EquipmentDefinition>,
    weaponsMap: Map<number, WeaponDefinition>,
    extrasMap: Map<number, string>,
    categoryMap: Map<number, number>, // unitId → category (from faction filters)
): ProcessedUnit {
    const profileGroups = (raw.profileGroups ?? []).map((pg, i) =>
        transformProfileGroup(pg, i, skillsMap, equipMap, weaponsMap, extrasMap),
    );

    // Attach category from faction filters (unit-level category)
    const unitCategory = categoryMap.get(raw.id) ?? 0;
    // The non-peripheral, non-FTO profile group is typically the "main" one
    // Use the first non-peripheral group's inferred category
    for (const pg of profileGroups) {
        if (!pg.isPeripheral) {
            (pg as unknown as { category: number }).category = unitCategory;
        }
    }

    // Pre-compute aggregates
    const allWeaponIds: number[] = [];
    const allSkillIds: number[] = [];
    const allEquipmentIds: number[] = [];
    const weaponIdSet = new Set<number>();
    const skillIdSet = new Set<number>();
    const equipIdSet = new Set<number>();
    let minPts = Infinity;
    let maxPts = -Infinity;
    let hasPeripherals = false;

    for (const pg of profileGroups) {
        if (pg.isPeripheral) hasPeripherals = true;

        for (const p of pg.profiles) {
            for (const s of p.skills) {
                if (!skillIdSet.has(s.id)) { skillIdSet.add(s.id); allSkillIds.push(s.id); }
            }
            for (const e of p.equipment) {
                if (!equipIdSet.has(e.id)) { equipIdSet.add(e.id); allEquipmentIds.push(e.id); }
            }
            for (const w of p.weapons) {
                if (!weaponIdSet.has(w.id)) { weaponIdSet.add(w.id); allWeaponIds.push(w.id); }
            }
        }

        for (const o of pg.options) {
            for (const s of o.skills) {
                if (!skillIdSet.has(s.id)) { skillIdSet.add(s.id); allSkillIds.push(s.id); }
            }
            for (const e of o.equipment) {
                if (!equipIdSet.has(e.id)) { equipIdSet.add(e.id); allEquipmentIds.push(e.id); }
            }
            for (const w of o.weapons) {
                if (!weaponIdSet.has(w.id)) { weaponIdSet.add(w.id); allWeaponIds.push(w.id); }
            }
            if (!pg.isPeripheral && o.points > 0) {
                if (o.points < minPts) minPts = o.points;
                if (o.points > maxPts) maxPts = o.points;
            }
        }
    }

    return {
        id: raw.id,
        isc: raw.isc,
        name: raw.name,
        slug: raw.slug,
        ...(raw.logo ?? raw.profileGroups?.[0]?.profiles?.[0]?.logo
            ? { logo: raw.logo ?? raw.profileGroups[0].profiles[0].logo }
            : {}),
        factionIds: raw.factions ?? [],
        profileGroups,
        allWeaponIds,
        allSkillIds,
        allEquipmentIds,
        pointsRange: [
            minPts === Infinity ? 0 : minPts,
            maxPts === -Infinity ? 0 : maxPts,
        ],
        hasPeripherals,
    };
}

// ============================================================================
// Transform fireteam chart
// ============================================================================

function transformFireteamChart(raw: RawFireteamChart | null | undefined): FactionFireteamChart | null {
    if (!raw) return null;

    const spec: FireteamSpec = {
        CORE: raw.spec?.CORE ?? 0,
        HARIS: raw.spec?.HARIS ?? 0,
        DUO: raw.spec?.DUO ?? 0,
    };

    const compositions: FireteamComposition[] = (raw.teams ?? []).map(team => {
        const types = Array.isArray(team.type) ? team.type : [team.type];
        return {
            name: team.name,
            type: types as FireteamComposition['type'],
            units: (team.units ?? []).map(u => ({
                slug: u.slug,
                name: u.name ?? u.isc ?? u.slug,
                min: u.min ?? 0,
                max: u.max ?? 5,
                required: u.required ?? false,
                comment: u.comment ?? u.obs ?? '',
            })),
            ...(team.obs ? { obs: team.obs } : {}),
        };
    });

    return { spec, compositions };
}

// ============================================================================
// Build category map from faction filters
// ============================================================================

function buildCategoryMap(factionData: RawFactionFile): Map<number, number> {
    // CB raw JSON stores categories in filters.category per profile group
    // But it's also in the unit's filters.categories array
    // We'll look at the unit-level filters array to get a category per unit
    const map = new Map<number, number>();
    for (const unit of factionData.units ?? []) {
        const unitFilters = (unit as unknown as { filters?: { categories?: number[] } }).filters;
        if (unitFilters?.categories?.length) {
            // Use the first non-zero category
            const cat = unitFilters.categories.find(c => c !== 0) ?? 0;
            map.set(unit.id, cat);
        }
    }
    return map;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('Reading metadata...');
    const metadata: RawMetadata = JSON.parse(
        await fs.readFile(path.join(DATA_DIR, 'metadata.json'), 'utf8'),
    );

    // Build name/wiki maps from metadata
    const skillsMap = new Map<number, SkillDefinition>();
    for (const s of metadata.skills ?? []) {
        skillsMap.set(s.id, { id: s.id, name: s.name, wikiUrl: s.wiki });
    }

    const equipMap = new Map<number, EquipmentDefinition>();
    for (const e of metadata.equips ?? []) {
        equipMap.set(e.id, { id: e.id, name: e.name, wikiUrl: e.wiki });
    }

    const weaponsMap = new Map<number, WeaponDefinition>();
    for (const w of metadata.weapons ?? []) {
        weaponsMap.set(w.id, {
            id: w.id,
            name: w.name,
            weaponType: (w.type ?? 'WEAPON') as WeaponDefinition['weaponType'],
            burst: String(w.burst ?? ''),
            damage: w.damage,
            saving: w.saving,
            savingNum: w.savingNum,
            ammunition: w.ammunition ?? undefined,
            properties: w.properties ?? [],
            distance: (w.distance as WeaponDefinition['distance']) ?? undefined,
            wikiUrl: w.wiki,
        });
    }

    const ammoMap = new Map<number, AmmunitionDefinition>();
    for (const a of metadata.ammunitions ?? []) {
        ammoMap.set(a.id, { id: a.id, name: a.name, wikiUrl: a.wiki });
    }

    const factionSlugs = metadata.factions.map(f => f.slug);

    // Build global extras map (merged across all factions)
    console.log('Building extras map...');
    const { extrasMap, distanceExtras: _ } = await buildExtrasMap(factionSlugs);
    console.log(`  ${extrasMap.size} extras`);

    // Ensure output directory exists
    await fs.mkdir(OUT_DIR, { recursive: true });

    // Write metadata file
    const processedMeta: ProcessedMetadataFile = {
        version: SCHEMA_VERSION,
        weapons: Array.from(weaponsMap.values()),
        skills: Array.from(skillsMap.values()),
        equipment: Array.from(equipMap.values()),
        ammunitions: Array.from(ammoMap.values()),
    };
    await fs.writeFile(
        path.join(OUT_DIR, 'metadata.json'),
        JSON.stringify(processedMeta),
    );
    console.log('Wrote metadata.json');

    // Build faction list
    const processedFactions: ProcessedFaction[] = metadata.factions.map(f => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        parentId: f.parent === f.id ? null : f.parent,
        isVanilla: f.parent === f.id,
        discontinued: f.discontinued,
        logo: f.logo ?? '',
        fireteams: null, // filled in per faction below
    }));

    // Process each faction file
    console.log(`\nProcessing ${factionSlugs.length} factions...`);
    let totalUnits = 0;
    const seenSlugs = new Set<string>();

    for (const factionMeta of metadata.factions) {
        const slug = factionMeta.slug;
        if (seenSlugs.has(slug)) {
            console.log(`  Skipping duplicate slug: ${slug}`);
            continue;
        }
        seenSlugs.add(slug);

        const filePath = path.join(DATA_DIR, `${slug}.json`);
        let factionData: RawFactionFile;
        try {
            factionData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        } catch {
            console.log(`  [SKIP] ${slug} — file not found`);
            continue;
        }

        const fireteams = transformFireteamChart(factionData.fireteamChart);

        // Update faction entry with fireteam data
        const factionEntry = processedFactions.find(f => f.slug === slug);
        if (factionEntry) factionEntry.fireteams = fireteams;

        const categoryMap = buildCategoryMap(factionData);

        const units: ProcessedUnit[] = (factionData.units ?? [])
            .filter(u => u && typeof u === 'object' && u.isc)
            .map(u => transformUnit(u, skillsMap, equipMap, weaponsMap, extrasMap, categoryMap));

        const processedFaction = processedFactions.find(f => f.slug === slug)!;
        if (!processedFaction) continue;

        const factionFile: ProcessedFactionFile = {
            version: SCHEMA_VERSION,
            faction: processedFaction,
            units,
        };

        await fs.writeFile(
            path.join(OUT_DIR, `${slug}.json`),
            JSON.stringify(factionFile),
        );

        totalUnits += units.length;
        console.log(`  ${slug}: ${units.length} units`);
    }

    // Write factions index
    const factionsFile: ProcessedFactionsFile = {
        version: SCHEMA_VERSION,
        factions: processedFactions,
    };
    await fs.writeFile(
        path.join(OUT_DIR, 'factions.json'),
        JSON.stringify(factionsFile),
    );
    console.log(`\nWrote factions.json (${processedFactions.length} factions)`);
    console.log(`Done. ${totalUnits} unit entries across all faction files.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
