// Tests use the existing local Postgres (docker compose `db` service) via DATABASE_URL.
// Ensure DEV_AUTH=true so `Bearer dev-token` works for auth-gated routes.
//
// We don't spin up a separate test DB — the dev DB is the source of seeded
// game data and a fresh dev-user. Tests clean up their own ephemeral rows.

export async function getApp() {
    // Lazy import so DATABASE_URL is read after vitest config sets it.
    const { app } = await import('../src/app.js');
    return app;
}

export const DEV_TOKEN_HEADER = { Authorization: 'Bearer dev-token' };

export async function ensureFaction(id: number): Promise<void> {
    const { db } = await import('../src/db/client.js');
    const { factions } = await import('../src/db/schema.js');
    await db
        .insert(factions)
        .values({ id, name: `Test Faction ${id}`, slug: `test-faction-${id}`, discontinued: false, logo: '' })
        .onConflictDoNothing();
}

export async function deleteListsForUser(userId: string): Promise<void> {
    const { db } = await import('../src/db/client.js');
    const { army_lists } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(army_lists).where(eq(army_lists.user_id, userId));
}
