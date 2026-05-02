import { Hono } from 'hono';
import { and, asc, eq, ilike, inArray, or, sql, gte, lte, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { units, factions, unit_factions, loadouts } from '../db/schema.js';

const router = new Hono();

interface UnitSummary {
    id: number;
    isc: string;
    name: string;
    slug: string;
    factions: string[];
    points_min: number;
    points_max: number;
}

router.get('/', async c => {
    const q = c.req.query('q') ?? undefined;
    const factionSlug = c.req.query('faction') ?? undefined;
    const hasWeapon = parseIntOrNull(c.req.query('has_weapon'));
    const hasSkill = parseIntOrNull(c.req.query('has_skill'));
    const hasEquipment = parseIntOrNull(c.req.query('has_equipment'));
    const minPoints = parseIntOrNull(c.req.query('min_points'));
    const maxPoints = parseIntOrNull(c.req.query('max_points'));
    const limit = clamp(parseIntOrNull(c.req.query('limit')) ?? 50, 1, 200);
    const offset = Math.max(parseIntOrNull(c.req.query('offset')) ?? 0, 0);

    const conditions: SQL[] = [];

    if (q) {
        const pattern = `%${q}%`;
        conditions.push(or(ilike(units.name, pattern), ilike(units.isc, pattern))!);
    }

    if (hasWeapon != null) {
        conditions.push(jsonbHas('weapons', hasWeapon));
    }
    if (hasSkill != null) {
        conditions.push(jsonbHas('skills', hasSkill));
    }
    if (hasEquipment != null) {
        conditions.push(jsonbHas('equip', hasEquipment));
    }

    let unitIds: number[] | null = null;
    if (factionSlug) {
        const matched = await db
            .select({ unit_id: unit_factions.unit_id })
            .from(unit_factions)
            .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
            .where(eq(factions.slug, factionSlug));
        unitIds = matched.map(r => r.unit_id);
        if (unitIds.length === 0) return c.json([]);
    }

    if (minPoints != null || maxPoints != null) {
        const ptsConditions: SQL[] = [];
        if (minPoints != null) ptsConditions.push(gte(loadouts.points, minPoints));
        if (maxPoints != null) ptsConditions.push(lte(loadouts.points, maxPoints));
        const ptsRows = await db
            .selectDistinct({ unit_id: loadouts.unit_id })
            .from(loadouts)
            .where(and(...ptsConditions));
        const ptsIds = ptsRows.map(r => r.unit_id);
        if (ptsIds.length === 0) return c.json([]);
        unitIds = unitIds ? unitIds.filter(id => ptsIds.includes(id)) : ptsIds;
        if (unitIds.length === 0) return c.json([]);
    }

    if (unitIds) conditions.push(inArray(units.id, unitIds));

    const baseRows = await db
        .selectDistinct({
            id: units.id,
            isc: units.isc,
            name: units.name,
            slug: units.slug,
        })
        .from(units)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(units.name))
        .limit(limit)
        .offset(offset);

    if (baseRows.length === 0) return c.json([]);
    const ids = baseRows.map(u => u.id);

    const [factionRows, loadoutRows] = await Promise.all([
        db
            .select({ unit_id: unit_factions.unit_id, slug: factions.slug })
            .from(unit_factions)
            .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
            .where(inArray(unit_factions.unit_id, ids)),
        db
            .select({ unit_id: loadouts.unit_id, points: loadouts.points })
            .from(loadouts)
            .where(inArray(loadouts.unit_id, ids)),
    ]);

    const factionsByUnit = new Map<number, string[]>();
    for (const r of factionRows) {
        const arr = factionsByUnit.get(r.unit_id) ?? [];
        arr.push(r.slug);
        factionsByUnit.set(r.unit_id, arr);
    }
    const ptsByUnit = new Map<number, number[]>();
    for (const r of loadoutRows) {
        const arr = ptsByUnit.get(r.unit_id) ?? [];
        arr.push(r.points);
        ptsByUnit.set(r.unit_id, arr);
    }

    const result: UnitSummary[] = baseRows.map(u => {
        const pts = ptsByUnit.get(u.id) ?? [];
        return {
            id: u.id,
            isc: u.isc,
            name: u.name,
            slug: u.slug,
            factions: factionsByUnit.get(u.id) ?? [],
            points_min: pts.length ? Math.min(...pts) : 0,
            points_max: pts.length ? Math.max(...pts) : 0,
        };
    });

    return c.json(result);
});

// Build a jsonb_path_exists condition matching either profiles[*].$kind or options[*].$kind
function jsonbHas(kind: 'weapons' | 'skills' | 'equip', id: number): SQL {
    const profilesPath = `$.profileGroups[*].profiles[*].${kind}[*] ? (@.id == ${id})`;
    const optionsPath = `$.profileGroups[*].options[*].${kind}[*] ? (@.id == ${id})`;
    return sql`(jsonb_path_exists(${units.raw_json}, ${profilesPath}::jsonpath) OR jsonb_path_exists(${units.raw_json}, ${optionsPath}::jsonpath))`;
}

function parseIntOrNull(v: string | undefined): number | null {
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export default router;
