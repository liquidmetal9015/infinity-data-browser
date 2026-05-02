import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { army_lists } from '../db/schema.js';
import { requireUser, type AuthVars } from '../auth/middleware.js';

const router = new OpenAPIHono<{ Variables: AuthVars }>();

router.use('*', requireUser);

// ── Schemas ──────────────────────────────────────────────────────────────

// `units_json` holds the full ArmyList object as built by the SPA. Validating
// every nested unit/profile shape on the wire is wasteful (50KB blob with
// denormalized catalog refs) and the SPA owns the structure. We treat it as
// an opaque object on the boundary.
const UnitsJsonSchema = z.record(z.string(), z.unknown()).openapi('UnitsJson');

const ListCreateSchema = z.object({
    name: z.string().max(255),
    description: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    rating: z.number().int().min(0).max(5).default(0),
    faction_id: z.number().int(),
    points: z.number().int().default(0),
    swc: z.number().default(0),
    units_json: UnitsJsonSchema.default({}),
}).openapi('ArmyListCreate');

const ListUpdateSchema = z.object({
    name: z.string().max(255).optional(),
    description: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().int().min(0).max(5).optional(),
    faction_id: z.number().int().optional(),
    points: z.number().int().optional(),
    swc: z.number().optional(),
    units_json: UnitsJsonSchema.optional(),
}).openapi('ArmyListUpdate');

const ListSummarySchema = z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    tags: z.array(z.string()),
    rating: z.number().int(),
    faction_id: z.number().int(),
    points: z.number().int(),
    swc: z.number(),
    unit_count: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
}).openapi('ArmyListSummary');

const ListDetailSchema = ListSummarySchema.extend({
    units_json: UnitsJsonSchema,
}).openapi('ArmyListDetail');

const ErrorSchema = z.object({
    detail: z.union([z.string(), z.array(z.unknown())]),
}).openapi('Error');

// ── Helpers ──────────────────────────────────────────────────────────────

interface UnitsJson {
    groups?: Array<{ units?: Array<{ isPeripheral?: boolean }> }>;
}

function unitCount(unitsJson: unknown): number {
    const obj = (unitsJson ?? {}) as UnitsJson;
    let count = 0;
    for (const g of obj.groups ?? []) {
        for (const u of g.units ?? []) {
            if (!u.isPeripheral) count++;
        }
    }
    return count;
}

function toIso(pgTimestamp: string): string {
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
    return { ...toSummary(row), units_json: row.units_json as Record<string, unknown> };
}

// ── Routes ───────────────────────────────────────────────────────────────

const listIdParam = z.object({
    listId: z.string().regex(/^\d+$/).transform(Number).openapi({ param: { name: 'listId', in: 'path' } }),
});

router.openapi(
    createRoute({
        method: 'get',
        path: '/',
        tags: ['lists'],
        summary: 'List the authenticated user\'s army lists',
        responses: {
            200: { content: { 'application/json': { schema: z.array(ListSummarySchema) } }, description: 'OK' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
        },
    }),
    async c => {
        const user = c.get('user');
        const rows = await db
            .select()
            .from(army_lists)
            .where(eq(army_lists.user_id, user.id))
            .orderBy(desc(army_lists.updated_at));
        return c.json(rows.map(toSummary), 200);
    },
);

router.openapi(
    createRoute({
        method: 'post',
        path: '/',
        tags: ['lists'],
        summary: 'Create an army list',
        request: {
            body: { content: { 'application/json': { schema: ListCreateSchema } }, required: true },
        },
        responses: {
            201: { content: { 'application/json': { schema: ListDetailSchema } }, description: 'Created' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
            422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation error' },
        },
    }),
    async c => {
        const user = c.get('user');
        const data = c.req.valid('json');
        const [row] = await db
            .insert(army_lists)
            .values({
                user_id: user.id,
                faction_id: data.faction_id,
                name: data.name,
                description: data.description ?? null,
                tags: data.tags,
                rating: data.rating,
                points: data.points,
                swc: data.swc,
                units_json: data.units_json,
            })
            .returning();
        return c.json(toDetail(row), 201);
    },
);

router.openapi(
    createRoute({
        method: 'get',
        path: '/{listId}',
        tags: ['lists'],
        summary: 'Get an army list by ID',
        request: { params: listIdParam },
        responses: {
            200: { content: { 'application/json': { schema: ListDetailSchema } }, description: 'OK' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
            404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
        },
    }),
    async c => {
        const user = c.get('user');
        const { listId } = c.req.valid('param');
        const [row] = await db
            .select()
            .from(army_lists)
            .where(and(eq(army_lists.id, listId), eq(army_lists.user_id, user.id)))
            .limit(1);
        if (!row) return c.json({ detail: 'List not found' }, 404);
        return c.json(toDetail(row), 200);
    },
);

router.openapi(
    createRoute({
        method: 'put',
        path: '/{listId}',
        tags: ['lists'],
        summary: 'Update an army list',
        request: {
            params: listIdParam,
            body: { content: { 'application/json': { schema: ListUpdateSchema } }, required: true },
        },
        responses: {
            200: { content: { 'application/json': { schema: ListDetailSchema } }, description: 'OK' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
            404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
            422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation error' },
        },
    }),
    async c => {
        const user = c.get('user');
        const { listId } = c.req.valid('param');
        const data = c.req.valid('json');

        const updates: Partial<typeof army_lists.$inferInsert> = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description ?? null;
        if (data.tags !== undefined) updates.tags = data.tags;
        if (data.rating !== undefined) updates.rating = data.rating;
        if (data.faction_id !== undefined) updates.faction_id = data.faction_id;
        if (data.points !== undefined) updates.points = data.points;
        if (data.swc !== undefined) updates.swc = data.swc;
        if (data.units_json !== undefined) updates.units_json = data.units_json;
        updates.updated_at = new Date().toISOString();

        const [row] = await db
            .update(army_lists)
            .set(updates)
            .where(and(eq(army_lists.id, listId), eq(army_lists.user_id, user.id)))
            .returning();
        if (!row) return c.json({ detail: 'List not found' }, 404);
        return c.json(toDetail(row), 200);
    },
);

router.openapi(
    createRoute({
        method: 'delete',
        path: '/{listId}',
        tags: ['lists'],
        summary: 'Delete an army list',
        request: { params: listIdParam },
        responses: {
            204: { description: 'Deleted' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
            404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
        },
    }),
    async c => {
        const user = c.get('user');
        const { listId } = c.req.valid('param');
        const result = await db
            .delete(army_lists)
            .where(and(eq(army_lists.id, listId), eq(army_lists.user_id, user.id)))
            .returning({ id: army_lists.id });
        if (result.length === 0) return c.json({ detail: 'List not found' }, 404);
        return c.body(null, 204);
    },
);

export default router;
