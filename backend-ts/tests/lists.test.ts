import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getApp, DEV_TOKEN_HEADER, deleteListsForUser } from './helpers.js';

const FACTION_ID = 101; // PanOceania (catalog is static JSON; faction_id is just an int)

describe('lists CRUD', () => {
    let app: Awaited<ReturnType<typeof getApp>>;

    beforeAll(async () => {
        app = await getApp();
        await deleteListsForUser('dev-user');
    });

    afterAll(async () => {
        await deleteListsForUser('dev-user');
    });

    it('create → read → update → delete round-trip', async () => {
        const createBody = JSON.stringify({
            name: 'Test List',
            faction_id: FACTION_ID,
            points: 300,
            swc: 6.0,
            units_json: { groups: [{ units: [{ isPeripheral: false }] }] },
        });

        const created = await app.fetch(new Request('http://localhost/api/lists', {
            method: 'POST',
            headers: { ...DEV_TOKEN_HEADER, 'Content-Type': 'application/json' },
            body: createBody,
        }));
        expect(created.status).toBe(201);
        const createdJson = await created.json() as { id: number; name: string; unit_count: number };
        expect(createdJson.name).toBe('Test List');
        expect(createdJson.unit_count).toBe(1);

        const listId = createdJson.id;

        const fetched = await app.fetch(new Request(`http://localhost/api/lists/${listId}`, {
            headers: DEV_TOKEN_HEADER,
        }));
        expect(fetched.status).toBe(200);
        const fetchedJson = await fetched.json() as { tags: string[] };
        // Regression: tags default must be [] not [""] (F-036)
        expect(fetchedJson.tags).toEqual([]);

        const all = await app.fetch(new Request('http://localhost/api/lists', {
            headers: DEV_TOKEN_HEADER,
        }));
        expect(all.status).toBe(200);
        const allJson = await all.json() as Array<{ id: number }>;
        expect(allJson.some(l => l.id === listId)).toBe(true);

        const updated = await app.fetch(new Request(`http://localhost/api/lists/${listId}`, {
            method: 'PUT',
            headers: { ...DEV_TOKEN_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Updated' }),
        }));
        expect(updated.status).toBe(200);
        expect(((await updated.json()) as { name: string }).name).toBe('Updated');

        const deleted = await app.fetch(new Request(`http://localhost/api/lists/${listId}`, {
            method: 'DELETE',
            headers: DEV_TOKEN_HEADER,
        }));
        expect(deleted.status).toBe(204);

        const after = await app.fetch(new Request(`http://localhost/api/lists/${listId}`, {
            headers: DEV_TOKEN_HEADER,
        }));
        expect(after.status).toBe(404);
    });

    it('rejects unauthenticated requests', async () => {
        const r = await app.fetch(new Request('http://localhost/api/lists'));
        expect(r.status).toBe(401);
    });
});
