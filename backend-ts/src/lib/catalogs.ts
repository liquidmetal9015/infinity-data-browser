import { db } from '../db/client.js';
import { weapons, skills, equipment } from '../db/schema.js';

export interface Catalogs {
    weapons: Map<number, string>;
    skills: Map<number, string>;
    equipment: Map<number, string>;
}

export async function getCatalogs(): Promise<Catalogs> {
    const [w, s, e] = await Promise.all([
        db.select({ id: weapons.id, name: weapons.name }).from(weapons),
        db.select({ id: skills.id, name: skills.name }).from(skills),
        db.select({ id: equipment.id, name: equipment.name }).from(equipment),
    ]);
    return {
        weapons: new Map(w.map(r => [r.id, r.name])),
        skills: new Map(s.map(r => [r.id, r.name])),
        equipment: new Map(e.map(r => [r.id, r.name])),
    };
}
