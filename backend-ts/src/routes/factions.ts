import { Hono } from 'hono';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { factions, fireteam_charts, unit_factions } from '../db/schema.js';
import { isVanilla } from '../lib/items.js';

const router = new Hono();

interface FactionSummary {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    is_vanilla: boolean;
    discontinued: boolean;
    logo: string;
}

interface SuperFactionResponse {
    id: number;
    name: string;
    vanilla: FactionSummary | null;
    sectorials: FactionSummary[];
}

router.get('/', async c => {
    const rows = await db.select().from(factions).orderBy(asc(factions.name));

    const groups = new Map<number, SuperFactionResponse>();

    for (const f of rows) {
        const summary: FactionSummary = {
            id: f.id,
            name: f.name,
            slug: f.slug,
            parent_id: f.parent_id,
            is_vanilla: isVanilla(f.parent_id, f.id),
            discontinued: f.discontinued,
            logo: f.logo,
        };
        const parentKey = f.parent_id ?? f.id;
        let group = groups.get(parentKey);
        if (!group) {
            group = { id: parentKey, name: '', vanilla: null, sectorials: [] };
            groups.set(parentKey, group);
        }
        if (summary.is_vanilla) {
            group.vanilla = summary;
            group.name = f.name;
            group.id = f.id;
        } else {
            group.sectorials.push(summary);
        }
    }

    for (const g of groups.values()) {
        if (!g.name && g.sectorials.length > 0) g.name = g.sectorials[0].name;
    }

    // Match Python's codepoint sort (case-sensitive) for parity with FastAPI service
    return c.json(
        [...groups.values()].sort((a, b) =>
            a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
        ),
    );
});

router.get('/:slug', async c => {
    const slug = c.req.param('slug');

    const [faction] = await db
        .select()
        .from(factions)
        .where(eq(factions.slug, slug))
        .limit(1);
    if (!faction) return c.json({ detail: `Faction '${slug}' not found` }, 404);

    const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(unit_factions)
        .where(eq(unit_factions.faction_id, faction.id));

    const [chart] = await db
        .select({ chart_json: fireteam_charts.chart_json })
        .from(fireteam_charts)
        .where(eq(fireteam_charts.faction_id, faction.id))
        .limit(1);

    return c.json({
        id: faction.id,
        name: faction.name,
        slug: faction.slug,
        parent_id: faction.parent_id,
        is_vanilla: isVanilla(faction.parent_id, faction.id),
        discontinued: faction.discontinued,
        logo: faction.logo,
        fireteam_chart: chart?.chart_json ?? null,
        unit_count: count,
    });
});

export default router;
