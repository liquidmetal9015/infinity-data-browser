import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { army_lists } from '../db/schema.js';
import { requireUser, type AuthVars } from '../auth/middleware.js';

const router = new Hono<{ Variables: AuthVars }>();

router.use('*', requireUser);

const ListCreateSchema = z.object({
    name: z.string().max(255),
    description: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    rating: z.number().int().min(0).max(5).default(0),
    faction_id: z.number().int(),
    points: z.number().int().default(0),
    swc: z.number().default(0),
    units_json: z.record(z.string(), z.unknown()).default({}),
});

const ListUpdateSchema = ListCreateSchema.partial();

interface UnitsJson {
    groups?: Array<{ units?: Array<{ isPeripheral?: boolean }> }>;
}

function unitCount(unitsJson: unknown): number {
    const obj = (unitsJson ?? {}) as UnitsJson;
    const groups = obj.groups ?? [];
    let count = 0;
    for (const g of groups) {
        for (const u of g.units ?? []) {
            if (!u.isPeripheral) count++;
        }
    }
    return count;
}

function toIso(pgTimestamp: string): string {
    // Postgres returns "2026-05-01 21:19:09.519708+00"; emit ISO 8601 to match Pydantic.
    return new Date(pgTimestamp).toISOString();
}

function toSummary(row: typeof army_lists.$inferSelect) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        tags: row.tags,
        rating: row.rating,
        faction_id: row.faction_id,
        points: row.points,
        swc: row.swc,
        unit_count: unitCount(row.units_json),
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
    };
}

function toDetail(row: typeof army_lists.$inferSelect) {
    return { ...toSummary(row), units_json: row.units_json };
}

router.get('/', async c => {
    const user = c.get('user');
    const rows = await db
        .select()
        .from(army_lists)
        .where(eq(army_lists.user_id, user.id))
        .orderBy(desc(army_lists.updated_at));
    return c.json(rows.map(toSummary));
});

router.post('/', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = ListCreateSchema.safeParse(body);
    if (!parsed.success) return c.json({ detail: parsed.error.issues }, 422);

    const [row] = await db
        .insert(army_lists)
        .values({
            user_id: user.id,
            faction_id: parsed.data.faction_id,
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            tags: parsed.data.tags,
            rating: parsed.data.rating,
            points: parsed.data.points,
            swc: parsed.data.swc,
            units_json: parsed.data.units_json,
        })
        .returning();

    return c.json(toDetail(row), 201);
});

router.get('/:listId', async c => {
    const user = c.get('user');
    const id = parseInt(c.req.param('listId'), 10);
    if (!Number.isFinite(id)) return c.json({ detail: 'List not found' }, 404);

    const [row] = await db
        .select()
        .from(army_lists)
        .where(and(eq(army_lists.id, id), eq(army_lists.user_id, user.id)))
        .limit(1);
    if (!row) return c.json({ detail: 'List not found' }, 404);
    return c.json(toDetail(row));
});

router.put('/:listId', async c => {
    const user = c.get('user');
    const id = parseInt(c.req.param('listId'), 10);
    if (!Number.isFinite(id)) return c.json({ detail: 'List not found' }, 404);

    const body = await c.req.json().catch(() => null);
    const parsed = ListUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ detail: parsed.error.issues }, 422);

    const updates: Partial<typeof army_lists.$inferInsert> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
    if (parsed.data.rating !== undefined) updates.rating = parsed.data.rating;
    if (parsed.data.faction_id !== undefined) updates.faction_id = parsed.data.faction_id;
    if (parsed.data.points !== undefined) updates.points = parsed.data.points;
    if (parsed.data.swc !== undefined) updates.swc = parsed.data.swc;
    if (parsed.data.units_json !== undefined) updates.units_json = parsed.data.units_json;
    updates.updated_at = new Date().toISOString();

    const [row] = await db
        .update(army_lists)
        .set(updates)
        .where(and(eq(army_lists.id, id), eq(army_lists.user_id, user.id)))
        .returning();

    if (!row) return c.json({ detail: 'List not found' }, 404);
    return c.json(toDetail(row));
});

router.delete('/:listId', async c => {
    const user = c.get('user');
    const id = parseInt(c.req.param('listId'), 10);
    if (!Number.isFinite(id)) return c.json({ detail: 'List not found' }, 404);

    const result = await db
        .delete(army_lists)
        .where(and(eq(army_lists.id, id), eq(army_lists.user_id, user.id)))
        .returning({ id: army_lists.id });
    if (result.length === 0) return c.json({ detail: 'List not found' }, 404);
    return c.body(null, 204);
});

export default router;
