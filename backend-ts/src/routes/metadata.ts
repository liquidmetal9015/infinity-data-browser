import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { weapons, skills, equipment, ammunitions } from '../db/schema.js';

const router = new Hono();

router.get('/', async c => {
    const [w, s, e, a] = await Promise.all([
        db.select().from(weapons).orderBy(asc(weapons.name)),
        db.select().from(skills).orderBy(asc(skills.name)),
        db.select().from(equipment).orderBy(asc(equipment.name)),
        db.select().from(ammunitions).orderBy(asc(ammunitions.name)),
    ]);

    return c.json({
        weapons: w.map(r => ({
            id: r.id,
            name: r.name,
            weapon_type: r.weapon_type,
            burst: r.burst,
            damage: r.damage,
            saving: r.saving,
            saving_num: r.saving_num,
            properties: Array.isArray(r.properties) ? r.properties : [],
            distance: r.distance ?? null,
            wiki_url: r.wiki_url,
        })),
        skills: s.map(r => ({ id: r.id, name: r.name, wiki_url: r.wiki_url })),
        equipment: e.map(r => ({ id: r.id, name: r.name, wiki_url: r.wiki_url })),
        ammunitions: a.map(r => ({ id: r.id, name: r.name, wiki_url: r.wiki_url })),
    });
});

export default router;
