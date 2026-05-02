import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './helpers.js';

describe('read-only routes', () => {
    let app: Awaited<ReturnType<typeof getApp>>;

    beforeAll(async () => {
        app = await getApp();
    });

    it('GET /api/health', async () => {
        const r = await app.fetch(new Request('http://localhost/api/health'));
        expect(r.status).toBe(200);
        expect(await r.json()).toEqual({ status: 'ok', version: '0.1.0' });
    });

    it('GET /api/factions returns grouped factions', async () => {
        const r = await app.fetch(new Request('http://localhost/api/factions'));
        expect(r.status).toBe(200);
        const data = await r.json() as Array<{ name: string; sectorials: unknown[] }>;
        expect(data.length).toBeGreaterThan(5);
        expect(data.every(g => typeof g.name === 'string' && Array.isArray(g.sectorials))).toBe(true);
    });

    it('GET /api/units returns array', async () => {
        const r = await app.fetch(new Request('http://localhost/api/units?limit=3'));
        expect(r.status).toBe(200);
        const data = await r.json() as unknown[];
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeLessThanOrEqual(3);
    });

    it('GET /api/metadata returns weapon/skill/equipment/ammo arrays', async () => {
        const r = await app.fetch(new Request('http://localhost/api/metadata'));
        expect(r.status).toBe(200);
        const data = await r.json() as { weapons: unknown[]; skills: unknown[]; equipment: unknown[]; ammunitions: unknown[] };
        expect(data.weapons.length).toBeGreaterThan(0);
        expect(data.skills.length).toBeGreaterThan(0);
    });

    it('GET /api/search?q=fusilier returns text matches', async () => {
        const r = await app.fetch(new Request('http://localhost/api/search?q=fusilier&limit=10'));
        expect(r.status).toBe(200);
        const data = await r.json() as Array<{ name: string }>;
        expect(data.length).toBeGreaterThan(0);
    });

    it('GET /api/search?has_skill=49 applies JSONB filter', async () => {
        const r = await app.fetch(new Request('http://localhost/api/search?has_skill=49&limit=200'));
        expect(r.status).toBe(200);
        const data = await r.json() as unknown[];
        expect(data.length).toBeGreaterThan(0); // 70 in current DB
    });
});
