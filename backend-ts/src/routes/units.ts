import { Hono } from 'hono';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
    units,
    factions,
    unit_factions,
    profiles,
    loadouts,
} from '../db/schema.js';
import { resolveItems, type ItemRef } from '../lib/items.js';
import { getCatalogs } from '../lib/catalogs.js';

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
    const factionSlug = c.req.query('faction') ?? undefined;
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

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

    const baseRows = await db
        .select({
            id: units.id,
            isc: units.isc,
            name: units.name,
            slug: units.slug,
        })
        .from(units)
        .where(unitIds ? inArray(units.id, unitIds) : undefined)
        .orderBy(asc(units.name))
        .limit(limit)
        .offset(offset);

    if (baseRows.length === 0) return c.json([]);
    const ids = baseRows.map(u => u.id);

    const factionRows = await db
        .select({
            unit_id: unit_factions.unit_id,
            slug: factions.slug,
        })
        .from(unit_factions)
        .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
        .where(inArray(unit_factions.unit_id, ids));

    const loadoutRows = await db
        .select({ unit_id: loadouts.unit_id, points: loadouts.points })
        .from(loadouts)
        .where(inArray(loadouts.unit_id, ids));

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

interface ProfileResponse {
    id: number;
    profile_group_id: number;
    name: string;
    mov: string;
    cc: number;
    bs: number;
    ph: number;
    wip: number;
    arm: number;
    bts: number;
    wounds: number;
    silhouette: number;
    is_structure: boolean;
    unit_type: number | null;
    skills: ItemRef[];
    equipment: ItemRef[];
    weapons: ItemRef[];
}

interface LoadoutResponse {
    id: number;
    option_id: number;
    profile_group_id: number;
    name: string;
    points: number;
    swc: number;
    skills: ItemRef[];
    equipment: ItemRef[];
    weapons: ItemRef[];
}

interface UnitDetailResponse {
    id: number;
    isc: string;
    name: string;
    slug: string;
    factions: string[];
    profiles: ProfileResponse[];
    loadouts: LoadoutResponse[];
}

router.get('/:slug', async c => {
    const slug = c.req.param('slug');

    const [unit] = await db.select().from(units).where(eq(units.slug, slug)).limit(1);
    if (!unit) return c.json({ detail: `Unit '${slug}' not found` }, 404);

    const [factionRows, profileRows, loadoutRows, catalogs] = await Promise.all([
        db
            .select({ slug: factions.slug })
            .from(unit_factions)
            .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
            .where(eq(unit_factions.unit_id, unit.id)),
        db.select().from(profiles).where(eq(profiles.unit_id, unit.id)),
        db.select().from(loadouts).where(eq(loadouts.unit_id, unit.id)),
        getCatalogs(),
    ]);

    const sortedProfiles = [...profileRows].sort(
        (a, b) => a.profile_group_id - b.profile_group_id || a.id - b.id,
    );
    const sortedLoadouts = [...loadoutRows].sort(
        (a, b) => a.profile_group_id - b.profile_group_id || a.option_id - b.option_id,
    );

    const response: UnitDetailResponse = {
        id: unit.id,
        isc: unit.isc,
        name: unit.name,
        slug: unit.slug,
        factions: factionRows.map(f => f.slug),
        profiles: sortedProfiles.map(p => ({
            id: p.id,
            profile_group_id: p.profile_group_id,
            name: p.name,
            mov: `${p.mov_1}-${p.mov_2}`,
            cc: p.cc,
            bs: p.bs,
            ph: p.ph,
            wip: p.wip,
            arm: p.arm,
            bts: p.bts,
            wounds: p.wounds,
            silhouette: p.silhouette,
            is_structure: p.is_structure,
            unit_type: p.unit_type,
            skills: resolveItems(p.skills_json, catalogs.skills),
            equipment: resolveItems(p.equipment_json, catalogs.equipment),
            weapons: resolveItems(p.weapons_json, catalogs.weapons),
        })),
        loadouts: sortedLoadouts.map(lo => ({
            id: lo.id,
            option_id: lo.option_id,
            profile_group_id: lo.profile_group_id,
            name: lo.name,
            points: lo.points,
            swc: lo.swc,
            skills: resolveItems(lo.skills_json, catalogs.skills),
            equipment: resolveItems(lo.equipment_json, catalogs.equipment),
            weapons: resolveItems(lo.weapons_json, catalogs.weapons),
        })),
    };

    return c.json(response);
});

export default router;
// Suppress unused warnings for `and` in case future filters need it
void and;
