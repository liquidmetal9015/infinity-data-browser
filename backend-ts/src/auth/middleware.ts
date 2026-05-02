import type { Context, MiddlewareHandler } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { config } from '../config.js';
import { verifyIdToken } from './firebase.js';

const DEV_UID = 'dev-user';
const DEV_EMAIL = 'dev@local';

export interface AuthUser {
    id: string;
    email: string;
}

export type AuthVars = { user: AuthUser };

function unauth(c: Context, detail: string): Response {
    return c.json({ detail }, 401);
}

async function provisionUser(uid: string, email: string): Promise<AuthUser> {
    // Atomic upsert: insert if missing, no-op on conflict; then read back.
    await db
        .insert(users)
        .values({ id: uid, email })
        .onConflictDoNothing();
    const [row] = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ${uid}`)
        .limit(1);
    if (!row) throw new Error('Failed to provision user');
    return { id: row.id, email: row.email };
}

export const requireUser: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) return unauth(c, 'Missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    if (!token) return unauth(c, 'Missing bearer token');

    let uid: string;
    let email: string;

    if (config.devAuth && token === 'dev-token') {
        uid = DEV_UID;
        email = DEV_EMAIL;
    } else {
        try {
            const decoded = await verifyIdToken(token);
            if (!decoded.uid || !decoded.email) {
                return unauth(c, 'Token missing required fields');
            }
            uid = decoded.uid;
            email = decoded.email;
        } catch (e) {
            return unauth(c, `Invalid authentication token: ${(e as Error).message}`);
        }
    }

    try {
        const user = await provisionUser(uid, email);
        c.set('user', user);
    } catch (e) {
        return c.json({ detail: 'Could not provision user', error: (e as Error).message }, 500);
    }
    await next();
};
